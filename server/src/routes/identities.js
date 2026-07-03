import express from 'express';
import { db, now, getSetting } from '../db.js';
import { asyncHandler, httpError } from '../util.js';
import { acquireContext, releaseContext, destroyProfile, identityKey } from '../services/browser.js';
import { getPlatform } from '../services/platforms/index.js';
import { startManagerSession } from '../services/loginSession.js';
import { refreshAccountStats } from '../services/poller.js';
import { notify } from '../services/notify.js';

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

// ---- Báo cáo tổng hợp cho một tài khoản quản lý ----
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function last12Months() {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) { out.unshift(monthKey(d)); d.setMonth(d.getMonth() - 1); }
  return out;
}
function viewsDelta30(accountId) {
  const latest = db.prepare('SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL ORDER BY taken_at DESC LIMIT 1').get(accountId);
  if (!latest) return null;
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const base = db.prepare('SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL AND taken_at <= ? ORDER BY taken_at DESC LIMIT 1').get(accountId, cutoff)
    || db.prepare('SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL ORDER BY taken_at ASC LIMIT 1').get(accountId);
  if (!base || base.views == null) return null;
  return Math.max(0, latest.views - base.views);
}

identitiesRouter.get('/:id/report', (req, res, next) => {
  const idn = db.prepare('SELECT * FROM identities WHERE id = ?').get(req.params.id);
  if (!idn) return next(httpError(404, 'Không tìm thấy tài khoản quản lý'));

  const currency = getSetting('currency', 'USD');
  const months = last12Months();
  const thisMonth = months[months.length - 1];
  const cutoff48 = Date.now() - 48 * 3600 * 1000;
  const accounts = db.prepare("SELECT * FROM accounts WHERE identity_id = ? AND status != 'connecting' ORDER BY created_at DESC").all(idn.id);

  const revThisMonth = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_entries WHERE account_id = ? AND month = ?');
  const rev12 = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_entries WHERE account_id = ? AND month >= ?');

  const totals = { channels: accounts.length, managed: 0, totalViews: 0, totalFollowers: 0, totalVideos: 0,
    views48h: 0, followers48h: 0, est30: 0, recordedThisMonth: 0, recorded12m: 0, monetizedCount: 0 };

  const channels = accounts.map((acc) => {
    const latest = db.prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at DESC LIMIT 1').get(acc.id);
    const base = db.prepare('SELECT * FROM stat_snapshots WHERE account_id = ? AND taken_at <= ? ORDER BY taken_at DESC LIMIT 1').get(acc.id, cutoff48)
      || db.prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at ASC LIMIT 1').get(acc.id);
    const diff = (a, b) => (latest && base && latest.id !== base.id && a != null && b != null ? a - b : 0);
    const v48 = diff(latest?.views, base?.views);
    const f48 = diff(latest?.followers, base?.followers);
    const v30 = viewsDelta30(acc.id);
    const est = acc.rpm != null && v30 != null ? (v30 / 1000) * acc.rpm : null;
    const rMonth = revThisMonth.get(acc.id, thisMonth).s;
    const r12 = rev12.get(acc.id, months[0]).s;

    totals.totalViews += latest?.views || 0;
    totals.totalFollowers += latest?.followers || 0;
    totals.totalVideos += latest?.videos || 0;
    totals.views48h += v48;
    totals.followers48h += f48;
    totals.est30 += est || 0;
    totals.recordedThisMonth += rMonth;
    totals.recorded12m += r12;
    if (acc.is_manager) totals.managed += 1;
    if (acc.monetized === 'yes') totals.monetizedCount += 1;

    return {
      id: acc.id, name: acc.name, platform: acc.platform, avatarUrl: acc.avatar_url,
      role: acc.role, monetized: acc.monetized, status: acc.status,
      views: latest?.views ?? null, followers: latest?.followers ?? null, videos: latest?.videos ?? null,
      views48h: v48, followers48h: f48, est30: est, recordedThisMonth: rMonth,
    };
  });

  // Doanh thu 12 tháng gộp tất cả kênh của tài khoản này
  const byMonth = new Map(db.prepare(
    `SELECT month, SUM(amount) total FROM revenue_entries
     WHERE account_id IN (SELECT id FROM accounts WHERE identity_id = ?) GROUP BY month`
  ).all(idn.id).map((r) => [r.month, r.total]));
  const monthly = months.map((m) => ({ month: m, total: byMonth.get(m) || 0 }));

  res.json({
    identity: { id: idn.id, name: idn.name, email: idn.email, avatarUrl: idn.avatar_url, platform: idn.platform,
      channelCount: accounts.length, lastSyncedAt: idn.last_synced_at },
    currency, thisMonth, totals, monthly, channels,
  });
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
    notify({
      level: 'info',
      title: 'Đã quét kênh',
      body: `${idn.name || idn.email || 'Tài khoản quản lý'}: phát hiện ${ids.length} kênh`,
      link: '/channels',
    });
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
