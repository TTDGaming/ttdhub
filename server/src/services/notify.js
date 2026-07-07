import { db, now } from '../db.js';

/**
 * Ghi một thông báo vào trung tâm thông báo.
 * - dedupKey: nếu có, và đã tồn tại một thông báo CHƯA đọc cùng key trong 6 giờ,
 *   thì cập nhật (đẩy lên mới) thay vì tạo bản trùng — tránh spam khi cùng một lỗi
 *   lặp lại (ví dụ kênh hết phiên bị nhiều job đụng vào).
 */
export function notify({ level = 'info', title, body = null, link = null, accountId = null, dedupKey = null } = {}) {
  if (!title) return null;
  try {
    if (dedupKey) {
      const existing = db.prepare(
        'SELECT id FROM notifications WHERE dedup_key = ? AND read = 0 AND created_at > ? ORDER BY id DESC LIMIT 1'
      ).get(dedupKey, now() - 6 * 3600 * 1000);
      if (existing) {
        db.prepare('UPDATE notifications SET level = ?, title = ?, body = ?, link = ?, account_id = ?, created_at = ? WHERE id = ?')
          .run(level, title, body, link, accountId, now(), existing.id);
        return existing.id;
      }
    }
    const info = db.prepare(
      'INSERT INTO notifications (level, title, body, link, account_id, dedup_key, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(level, title, body, link, accountId, dedupKey, now());
    // Giữ tối đa 500 thông báo mới nhất.
    db.prepare('DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY id DESC LIMIT 500)').run();
    return Number(info.lastInsertRowid);
  } catch (err) {
    console.error('[notify] lỗi ghi thông báo:', err.message);
    return null;
  }
}
