import express from 'express';
import { db, now } from '../db.js';
import { asyncHandler, httpError } from '../util.js';
import { acquireContext, releaseContext, destroyProfile, identityKey } from '../services/browser.js';
import { getPlatform } from '../services/platforms/index.js';
import { startManagerSession } from '../services/loginSession.js';
import { refreshAccountStats } from '../services/poller.js';

export const identitiesRouter = express.Router();

function mapIdentity(idn) {
  const channels = db.prepare(
    "SELECT COUNT(*) c, SUM(is_manager) m FROM accounts WHERE identity_id = ?"
  ).get(idn.id);
  return {
    id: idn.id,
    platform: idn.platform,
    kind: idn.kind,
    email: idn.email,
    name: idn.name,
    avatarUrl: idn.avatar_url,
    status: idn.status,
    lastSyncedAt: idn.last_synced_at,
    channelCount: channels.c || 0,
    managedCount: channels.m || 0,
  };
}

identitiesRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM identities ORDER BY created_at DESC').all();
  res.json(rows.map(mapIdentity));
});

// Bắt đầu kết nối một tài khoản quản lý mới.
identitiesRouter.post('/connect/:platform', asyncHandler(async (req, res) => {
  const { sessionId, identityId } = await startManagerSession(req.params.platform);
  res.json({ sessionId, identityId });
}));

// Mở lại trình duyệt của tài khoản quản lý (đăng nhập lại khi hết phiên).
identitiesRouter.post('/:id/reopen', asyncHandler(async (req, res) => {
  const idn = db.prepare('SELECT * FROM identities WHERE id = ?').get(req.params.id);
  if (!idn) throw httpError(404, 'Không tìm thấy tài khoản quản lý');
  const { sessionId } = await startManagerSession(idn.platform, idn.id);
  res.json({ sessionId, identityId: idn.id });
}));

/**
 * Quét lại danh sách kênh (không cần thao tác người dùng nếu phiên còn hiệu lực).
 * Dùng chính cookie đã lưu để phát hiện thêm/bớt kênh được cấp quyền.
 */
identitiesRouter.post('/:id/rediscover', asyncHandler(async (req, res) => {
  const idn = db.prepare('SELECT * FROM identities WHERE id = ?').get(req.params.id);
  if (!idn) throw httpError(404, 'Không tìm thấy tài khoản quản lý');
  const platform = getPlatform(idn.platform);
  const profileKey = identityKey(idn.id);
  const context = await acquireContext(profileKey);
  try {
    if (!(await platform.isLoggedIn(context))) {
      db.prepare("UPDATE identities SET status = 'error' WHERE id = ?").run(idn.id);
      throw httpError(409, 'Phiên đăng nhập đã hết hạn — hãy mở trình duyệt và đăng nhập lại');
    }
    const discovered = platform.discoverChannels ? await platform.discoverChannels(context) : [];
    const upsert = db.prepare(`
      INSERT INTO accounts (platform, identity_id, external_id, name, handle, avatar_url, page_id, role, is_manager, status, created_at)
      VALUES (@platform, @identity_id, @external_id, @name, @handle, @avatar_url, @page_id, @role, @is_manager, 'active', @created_at)
      ON CONFLICT(identity_id, external_id) DO UPDATE SET
        name = excluded.name, handle = excluded.handle, avatar_url = excluded.avatar_url,
        page_id = excluded.page_id, status = 'active'
    `);
    const ids = [];
    const tx = db.transaction(() => {
      for (const ch of discovered) {
        const ext = ch.externalId ? String(ch.externalId) : `${idn.id}:${ch.handle || ch.name}`;
        const isSelf = !!ch.isSelf || (idn.external_id && String(ch.externalId) === String(idn.external_id));
        upsert.run({
          platform: idn.platform, identity_id: idn.id, external_id: ext,
          name: ch.name || 'Kênh', handle: ch.handle || null, avatar_url: ch.avatarUrl || null,
          page_id: ch.pageId || null, role: isSelf ? 'self' : 'manager', is_manager: isSelf ? 0 : 1,
          created_at: now(),
        });
        const row = db.prepare('SELECT id FROM accounts WHERE identity_id = ? AND external_id = ?').get(idn.id, ext);
        if (row) ids.push(row.id);
      }
    });
    tx();
    db.prepare("UPDATE identities SET status = 'active', last_synced_at = ? WHERE id = ?").run(now(), idn.id);
    for (const accId of ids) refreshAccountStats(accId).catch(() => {});
    res.json({ ok: true, channels: ids.length });
  } finally {
    await releaseContext(profileKey);
  }
}));

identitiesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const idn = db.prepare('SELECT * FROM identities WHERE id = ?').get(req.params.id);
  if (!idn) throw httpError(404, 'Không tìm thấy tài khoản quản lý');
  db.prepare('DELETE FROM identities WHERE id = ?').run(idn.id); // cascade xóa accounts
  await destroyProfile(identityKey(idn.id));
  res.json({ ok: true });
}));
