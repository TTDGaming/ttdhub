import { db, now } from '../db.js';
import { randomToken } from '../crypto.js';
import { acquireContext, releaseContext, destroyProfile } from './browser.js';
import { getPlatform } from './platforms/index.js';
import { refreshAccountStats } from './poller.js';

/**
 * Phiên đăng nhập từ xa: mở trình duyệt cách ly của tài khoản mới,
 * stream màn hình (CDP screencast) tới web app qua WebSocket và
 * chuyển tiếp chuột/bàn phím của người dùng vào trang đăng nhập.
 */

const sessions = new Map(); // sessionId -> session

export function getLoginSession(id) {
  return sessions.get(id) || null;
}

export async function startLoginSession(platformName) {
  const platform = getPlatform(platformName);

  // Tạo bản ghi tài khoản trước để có ID → thư mục profile cách ly riêng
  const info = db
    .prepare("INSERT INTO accounts (platform, status, created_at) VALUES (?, 'connecting', ?)")
    .run(platformName, now());
  const accountId = Number(info.lastInsertRowid);

  const context = await acquireContext(accountId);
  const page = await context.newPage();
  await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  const id = randomToken(16);
  const session = {
    id,
    accountId,
    platform: platformName,
    context,
    page,
    cdp: null,
    ws: null,
    done: false,
    createdAt: now(),
  };
  sessions.set(id, session);

  // Tự hủy sau 15 phút nếu không hoàn tất
  session.timeout = setTimeout(() => cancelLoginSession(id).catch(() => {}), 15 * 60 * 1000);
  return { sessionId: id, accountId };
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
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 55,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 1,
  });

  // Nếu trang điều hướng (popup OAuth của Google dùng cùng tab nên ổn), theo dõi URL
  const urlTimer = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'url', url: session.page.url() }));
    }
  }, 2000);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    try {
      await handleInput(session, msg);
    } catch { /* input lỗi không làm sập phiên */ }
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
    case 'mouse': {
      // msg: { type:'mouse', event:'mousePressed'|'mouseReleased'|'mouseMoved'|'mouseWheel', x, y, button, deltaX, deltaY, clickCount }
      await cdp.send('Input.dispatchMouseEvent', {
        type: msg.event,
        x: msg.x,
        y: msg.y,
        button: msg.button || 'none',
        buttons: msg.event === 'mousePressed' || (msg.event === 'mouseMoved' && msg.buttons) ? 1 : 0,
        clickCount: msg.clickCount || (msg.event === 'mousePressed' || msg.event === 'mouseReleased' ? 1 : 0),
        deltaX: msg.deltaX || 0,
        deltaY: msg.deltaY || 0,
        pointerType: 'mouse',
      });
      break;
    }
    case 'key': {
      // msg: { type:'key', event:'keyDown'|'keyUp', key, code, text, keyCode, modifiers }
      const params = {
        type: msg.event === 'keyDown' && msg.text ? 'keyDown' : msg.event,
        key: msg.key,
        code: msg.code,
        windowsVirtualKeyCode: msg.keyCode || 0,
        nativeVirtualKeyCode: msg.keyCode || 0,
        modifiers: msg.modifiers || 0,
      };
      if (msg.event === 'keyDown' && msg.text) params.text = msg.text;
      await cdp.send('Input.dispatchKeyEvent', params);
      break;
    }
    case 'paste': {
      if (typeof msg.text === 'string' && msg.text.length <= 10000) {
        await cdp.send('Input.insertText', { text: msg.text });
      }
      break;
    }
    case 'navigate': {
      if (typeof msg.url === 'string' && /^https:\/\//.test(msg.url)) {
        await page.goto(msg.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      }
      break;
    }
    default:
      break;
  }
}

/** Kiểm tra đã đăng nhập chưa (gọi định kỳ từ client hoặc khi bấm Hoàn tất). */
export async function checkLoginSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Phiên không tồn tại hoặc đã hết hạn');
  const platform = getPlatform(session.platform);
  const loggedIn = await platform.isLoggedIn(session.context);
  return { loggedIn };
}

/** Hoàn tất: nhận diện kênh, lưu thông tin, đóng phiên stream. */
export async function finishLoginSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Phiên không tồn tại hoặc đã hết hạn');
  const platform = getPlatform(session.platform);

  const loggedIn = await platform.isLoggedIn(session.context);
  if (!loggedIn) throw new Error('Chưa phát hiện đăng nhập thành công — hãy đăng nhập xong rồi bấm Hoàn tất');

  const identity = await platform.fetchIdentity(session.context);
  db.prepare(
    "UPDATE accounts SET name = ?, handle = ?, avatar_url = ?, external_id = ?, status = 'active' WHERE id = ?"
  ).run(identity.name, identity.handle, identity.avatarUrl, String(identity.externalId), session.accountId);

  await teardown(session);

  // Lấy số liệu đầu tiên ngay (nền, không chặn phản hồi)
  refreshAccountStats(session.accountId).catch(() => {});
  return { accountId: session.accountId, identity };
}

/** Hủy phiên: xóa luôn bản ghi tài khoản tạm + profile. */
export async function cancelLoginSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  const { accountId } = session;
  await teardown(session);
  const acc = db.prepare('SELECT status FROM accounts WHERE id = ?').get(accountId);
  if (acc && acc.status === 'connecting') {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    await destroyProfile(accountId);
  }
}

async function teardown(session) {
  session.done = true;
  clearTimeout(session.timeout);
  sessions.delete(session.id);
  try { session.ws?.close(); } catch { /* đã đóng */ }
  try { await session.cdp?.send('Page.stopScreencast'); } catch { /* đã đóng */ }
  try { await session.page.close(); } catch { /* đã đóng */ }
  await releaseContext(session.accountId);
}
