import { db, now } from '../db.js';
import { POLL_INTERVAL_MIN } from '../config.js';
import { acquireContext, releaseContext, accountKey } from './browser.js';
import { getPlatform } from './platforms/index.js';

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
        console.error(`[poller] Lỗi thu số liệu tài khoản ${id}:`, err.message);
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
