import { db, now } from '../db.js';
import { randomToken } from '../crypto.js';
import {
  acquireContext, releaseContext, destroyProfile, accountKey, identityKey,
} from './browser.js';
import { getPlatform } from './platforms/index.js';
import { refreshAccountStats } from './poller.js';

/**
 * Phiên đăng nhập từ xa (CDP screencast qua WebSocket). Hai loại:
 *  - 'single'  : kết nối một kênh độc lập (profile riêng acc_<id>) — như trước.
 *  - 'manager' : đăng nhập MỘT tài khoản Google, tự phát hiện & thêm tất cả kênh
 *                mà tài khoản được cấp quyền quản lý (profile chung id_<identityId>).
 */

const sessions = new Map(); // sessionId -> session

export function getLoginSession(id) {
  return sessions.get(id) || null;
}

function makeSession(base) {
  const id = randomToken(16);
  const session = { id, ws: null, cdp: null, done: false, createdAt: now(), ...base };
  sessions.set(id, session);
  session.timeout = setTimeout(() => cancelLoginSession(id).catch(() => {}), 15 * 60 * 1000);
  return session;
}

async function openLoginPage(context, platform, atHome) {
  const page = await context.newPage();
  const url = atHome ? platform.homeUrl || platform.loginUrl : platform.loginUrl;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  return page;
}

// ---------- Kết nối kênh độc lập (một kênh / một profile) ----------
export async function startLoginSession(platformName, existingAccountId = null) {
  const platform = getPlatform(platformName);

  // Mở lại một kênh đã có: nếu kênh thuộc tài khoản quản lý -> mở phiên manager.
  if (existingAccountId) {
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(existingAccountId);
    if (!acc) throw new Error('Không tìm thấy kênh');
    if (acc.identity_id) return startManagerSession(platformName, acc.identity_id);

    const profileKey = accountKey(acc); // acc_<id>
    const context = await acquireContext(profileKey);
    const loggedIn = await platform.isLoggedIn(context).catch(() => false);
    const page = await openLoginPage(context, platform, loggedIn);
    const session = makeSession({ type: 'single', platform: platformName, profileKey, accountId: acc.id, isNew: false, context, page });
    return { sessionId: session.id, accountId: acc.id };
  }

  // Kênh mới độc lập: tạo bản ghi tạm để có id -> profile riêng.
  const info = db.prepare("INSERT INTO accounts (platform, status, role, created_at) VALUES (?, 'connecting', 'owner', ?)")
    .run(platformName, now());
  const accountId = Number(info.lastInsertRowid);
  const profileKey = accountKey({ id: accountId, identity_id: null });
  const context = await acquireContext(profileKey);
  const page = await openLoginPage(context, platform, false);
  const session = makeSession({ type: 'single', platform: platformName, profileKey, accountId, isNew: true, context, page });
  return { sessionId: session.id, accountId };
}

// ---------- Kết nối tài khoản quản lý (một login -> nhiều kênh) ----------
export async function startManagerSession(platformName, existingIdentityId = null) {
  const platform = getPlatform(platformName);
  let identityId;
  let isNew = false;
  if (existingIdentityId) {
    const idn = db.prepare('SELECT * FROM identities WHERE id = ?').get(existingIdentityId);
    if (!idn) throw new Error('Không tìm thấy tài khoản quản lý');
    identityId = idn.id;
  } else {
    const info = db.prepare(
      "INSERT INTO identities (platform, kind, status, created_at) VALUES (?, 'manager', 'connecting', ?)"
    ).run(platformName, now());
    identityId = Number(info.lastInsertRowid);
    isNew = true;
  }
  const profileKey = identityKey(identityId);
  const context = await acquireContext(profileKey);
  const loggedIn = await platform.isLoggedIn(context).catch(() => false);
  const page = await openLoginPage(context, platform, loggedIn);
  const session = makeSession({ type: 'manager', platform: platformName, profileKey, identityId, isNew, context, page });
  return { sessionId: session.id, identityId };
}

/** Gắn WebSocket vào phiên: bắt đầu screencast + nhận input. */
export async function attachWebSocket(session, ws) {
  if (session.ws) {
    try { session.ws.close(); } catch { /* thay kết nối cũ */ }
  }
  session.ws = ws;
  const cdp = await session.context.newCDPSession(session.page);
  session.cdp = cdp;

  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'frame', data }));
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch { /* phiên có thể đã đóng */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });

  const urlTimer = setInterval(() => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'url', url: session.page.url() }));
  }, 2000);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    try { await handleInput(session, msg); } catch { /* input lỗi không làm sập phiên */ }
  });

  ws.on('close', async () => {
    clearInterval(urlTimer);
    try { await cdp.send('Page.stopScreencast'); } catch { /* đã đóng */ }
    if (session.ws === ws) session.ws = null;
  });
}

async function handleInput(session, msg) {
  const { cdp, page } = session;
  if (!cdp) return;
  switch (msg.type) {
    case 'mouse':
      await cdp.send('Input.dispatchMouseEvent', {
        type: msg.event, x: msg.x, y: msg.y, button: msg.button || 'none',
        buttons: msg.event === 'mousePressed' || (msg.event === 'mouseMoved' && msg.buttons) ? 1 : 0,
        clickCount: msg.clickCount || (msg.event === 'mousePressed' || msg.event === 'mouseReleased' ? 1 : 0),
        deltaX: msg.deltaX || 0, deltaY: msg.deltaY || 0, pointerType: 'mouse',
      });
      break;
    case 'key': {
      const params = {
        type: msg.event === 'keyDown' && msg.text ? 'keyDown' : msg.event,
        key: msg.key, code: msg.code,
        windowsVirtualKeyCode: msg.keyCode || 0, nativeVirtualKeyCode: msg.keyCode || 0,
        modifiers: msg.modifiers || 0,
      };
      if (msg.event === 'keyDown' && msg.text) params.text = msg.text;
      await cdp.send('Input.dispatchKeyEvent', params);
      break;
    }
    case 'paste':
      if (typeof msg.text === 'string' && msg.text.length <= 10000) {
        await cdp.send('Input.insertText', { text: msg.text });
      }
      break;
    case 'navigate':
      if (typeof msg.url === 'string' && /^https:\/\//.test(msg.url)) {
        await page.goto(msg.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      }
      break;
    default:
      break;
  }
}

export async function checkLoginSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Phiên không tồn tại hoặc đã hết hạn');
  const platform = getPlatform(session.platform);
  return { loggedIn: await platform.isLoggedIn(session.context) };
}

/** Hoàn tất phiên — dispatch theo loại. */
export async function finishLoginSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Phiên không tồn tại hoặc đã hết hạn');
  return session.type === 'manager' ? finishManager(session) : finishSingle(session);
}

async function finishSingle(session) {
  const platform = getPlatform(session.platform);
  if (!(await platform.isLoggedIn(session.context))) {
    throw new Error('Chưa phát hiện đăng nhập thành công — hãy đăng nhập xong rồi bấm Hoàn tất');
  }
  const identity = await platform.fetchIdentity(session.context);
  const existing = db.prepare('SELECT external_id, status FROM accounts WHERE id = ?').get(session.accountId);
  if (existing?.status !== 'connecting' && existing?.external_id && existing.external_id !== String(identity.externalId)) {
    throw new Error('Tài khoản vừa đăng nhập khác với kênh ban đầu — hãy đăng nhập đúng tài khoản của kênh này');
  }
  db.prepare("UPDATE accounts SET name = ?, handle = ?, avatar_url = ?, external_id = ?, status = 'active' WHERE id = ?")
    .run(identity.name, identity.handle, identity.avatarUrl, String(identity.externalId), session.accountId);
  await teardown(session);
  refreshAccountStats(session.accountId).catch(() => {});
  return { accountId: session.accountId, identity, channels: 1 };
}

async function finishManager(session) {
  const platform = getPlatform(session.platform);
  if (!(await platform.isLoggedIn(session.context))) {
    throw new Error('Chưa phát hiện đăng nhập thành công — hãy đăng nhập xong rồi bấm Hoàn tất');
  }
  const self = await platform.fetchIdentity(session.context);
  db.prepare("UPDATE identities SET name = ?, avatar_url = ?, external_id = ?, status = 'active', last_synced_at = ? WHERE id = ?")
    .run(self.name, self.avatarUrl, self.externalId ? String(self.externalId) : null, now(), session.identityId);

  // Phát hiện kênh (chỉ YouTube). Nền tảng khác: coi login là một kênh.
  let discovered = [];
  if (platform.discoverChannels) {
    discovered = await platform.discoverChannels(session.context).catch(() => []);
  }
  // Luôn đảm bảo có kênh gốc của login.
  const selfKey = self.externalId ? String(self.externalId) : (self.handle || self.name);
  if (!discovered.some((c) => (c.externalId && String(c.externalId) === String(self.externalId)) || c.isSelf)) {
    discovered.unshift({ externalId: self.externalId, name: self.name, handle: self.handle, avatarUrl: self.avatarUrl, pageId: null, isSelf: true });
  }

  const upsert = db.prepare(`
    INSERT INTO accounts (platform, identity_id, external_id, name, handle, avatar_url, page_id, role, is_manager, status, created_at)
    VALUES (@platform, @identity_id, @external_id, @name, @handle, @avatar_url, @page_id, @role, @is_manager, 'active', @created_at)
    ON CONFLICT(identity_id, external_id) DO UPDATE SET
      name = excluded.name, handle = excluded.handle, avatar_url = excluded.avatar_url,
      page_id = excluded.page_id, role = excluded.role, is_manager = excluded.is_manager, status = 'active'
  `);
  const ids = [];
  const tx = db.transaction(() => {
    for (const ch of discovered) {
      const ext = ch.externalId ? String(ch.externalId) : `${session.identityId}:${ch.handle || ch.name}`;
      const isSelf = !!ch.isSelf || (self.externalId && String(ch.externalId) === String(self.externalId));
      upsert.run({
        platform: session.platform,
        identity_id: session.identityId,
        external_id: ext,
        name: ch.name || 'Kênh YouTube',
        handle: ch.handle || null,
        avatar_url: ch.avatarUrl || null,
        page_id: ch.pageId || null,
        role: isSelf ? 'self' : 'manager',
        is_manager: isSelf ? 0 : 1,
        created_at: now(),
      });
      const row = db.prepare('SELECT id FROM accounts WHERE identity_id = ? AND external_id = ?').get(session.identityId, ext);
      if (row) ids.push(row.id);
    }
  });
  tx();

  await teardown(session);
  for (const accId of ids) refreshAccountStats(accId).catch(() => {});
  return { identityId: session.identityId, channels: ids.length };
}

/** Hủy phiên — dọn bản ghi tạm nếu vừa tạo. */
export async function cancelLoginSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  await teardown(session);
  if (session.type === 'single') {
    const acc = db.prepare('SELECT status FROM accounts WHERE id = ?').get(session.accountId);
    if (acc && acc.status === 'connecting') {
      db.prepare('DELETE FROM accounts WHERE id = ?').run(session.accountId);
      await destroyProfile(session.profileKey);
    }
  } else if (session.type === 'manager' && session.isNew) {
    const idn = db.prepare('SELECT status FROM identities WHERE id = ?').get(session.identityId);
    if (idn && idn.status === 'connecting') {
      db.prepare('DELETE FROM identities WHERE id = ?').run(session.identityId); // cascade xóa accounts
      await destroyProfile(session.profileKey);
    }
  }
}

async function teardown(session) {
  session.done = true;
  clearTimeout(session.timeout);
  sessions.delete(session.id);
  try { session.ws?.close(); } catch { /* đã đóng */ }
  try { await session.cdp?.send('Page.stopScreencast'); } catch { /* đã đóng */ }
  try { await session.page.close(); } catch { /* đã đóng */ }
  await releaseContext(session.profileKey);
}
