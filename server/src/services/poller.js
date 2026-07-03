import { db, now } from '../db.js';
import { POLL_INTERVAL_MIN } from '../config.js';
import { acquireContext, releaseContext, accountKey } from './browser.js';
import { getPlatform } from './platforms/index.js';
import { notify } from './notify.js';

/**
 * Bộ thu số liệu: định kỳ mở phiên (cách ly) của từng tài khoản,
 * đọc số liệu công khai của kênh và lưu snapshot để vẽ biểu đồ 48h.
 */

let running = false;

export async function refreshAccountStats(accountId) {
  const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND status = 'active'").get(accountId);
  if (!account) throw new Error('Tài khoản không tồn tại hoặc chưa kết nối xong');
  const platform = getPlatform(account.platform);
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    const stats = await platform.fetchStats(context, account);
    if (stats && (stats.views != null || stats.followers != null || stats.likes != null)) {
      db.prepare(
        'INSERT INTO stat_snapshots (account_id, taken_at, views, followers, likes, videos) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(accountId, now(), stats.views, stats.followers, stats.likes, stats.videos);
    }
    return stats;
  } finally {
    await releaseContext(profileKey);
  }
}

export async function pollAll() {
  if (running) return;
  running = true;
  try {
    const accounts = db.prepare("SELECT id FROM accounts WHERE status = 'active'").all();
    for (const { id } of accounts) {
      try {
        await refreshAccountStats(id);
      } catch (err) {
        const message = String(err?.message || err);
        console.error(`[poller] Lỗi thu số liệu tài khoản ${id}:`, message);
        if (/hết hạn/i.test(message)) {
          const acc = db.prepare('SELECT name, identity_id FROM accounts WHERE id = ?').get(id);
          db.prepare("UPDATE accounts SET status = 'error' WHERE id = ?").run(id);
          if (acc?.identity_id) db.prepare("UPDATE identities SET status = 'error' WHERE id = ?").run(acc.identity_id);
          notify({
            level: 'warning',
            title: 'Kênh cần đăng nhập lại',
            body: `${acc?.name || 'Kênh'} — phiên hết hạn khi thu số liệu`,
            link: `/channels/${id}`,
            accountId: id,
            dedupKey: `reauth-${acc?.identity_id ? `idn${acc.identity_id}` : id}`,
          });
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startPoller() {
  setTimeout(() => pollAll().catch(() => {}), 20 * 1000); // lần đầu sau khi khởi động 20s
  setInterval(() => pollAll().catch(() => {}), POLL_INTERVAL_MIN * 60 * 1000);
}
