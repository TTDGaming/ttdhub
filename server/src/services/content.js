import fs from 'node:fs';
import path from 'node:path';
import { db, now } from '../db.js';
import { DEBUG_DIR } from '../config.js';
import { acquireContext, releaseContext, accountKey } from './browser.js';
import { getPlatform } from './platforms/index.js';

/**
 * Dịch vụ nội dung kênh (tab Nội dung + Cộng đồng của "Studio kênh").
 *
 * Ma trận nguồn dữ liệu:
 *  - Danh sách video + view: đọc trang video CÔNG KHAI (ổn định, không cần login).
 *  - Like/bình luận từng video, xóa/tải video, hộp thư bình luận: cần phiên đăng
 *    nhập và thao tác Studio (best-effort — YouTube đổi giao diện có thể phải cập nhật).
 *  - TikTok / Facebook: chưa hỗ trợ (supported=false) — UI hiển thị trạng thái rỗng gọn gàng.
 */

function getAccount(accountId) {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!acc) throw new Error('Không tìm thấy kênh');
  return acc;
}

export function isSupported(account) {
  const platform = getPlatform(account.platform);
  return !!platform.supportsContent;
}

const upsertVideo = db.prepare(`
  INSERT INTO videos (account_id, video_id, title, thumbnail_url, url, published_at, published_text, duration, views, likes, comments, privacy, fetched_at)
  VALUES (@account_id, @video_id, @title, @thumbnail_url, @url, @published_at, @published_text, @duration, @views, @likes, @comments, @privacy, @fetched_at)
  ON CONFLICT(account_id, video_id) DO UPDATE SET
    title = excluded.title, thumbnail_url = excluded.thumbnail_url, url = excluded.url,
    published_text = excluded.published_text, duration = excluded.duration,
    views = COALESCE(excluded.views, videos.views),
    likes = COALESCE(excluded.likes, videos.likes),
    comments = COALESCE(excluded.comments, videos.comments),
    privacy = excluded.privacy, fetched_at = excluded.fetched_at
`);

export async function refreshVideos(accountId) {
  const account = getAccount(accountId);
  const platform = getPlatform(account.platform);
  if (!platform.supportsContent || !platform.fetchVideos) return { count: 0, supported: false };
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    const videos = await platform.fetchVideos(context, account);
    const ts = now();
    const tx = db.transaction(() => {
      for (const v of videos) {
        upsertVideo.run({
          account_id: accountId,
          video_id: v.videoId,
          title: v.title || null,
          thumbnail_url: v.thumbnailUrl || null,
          url: v.url || null,
          published_at: v.publishedAt || null,
          published_text: v.publishedText || null,
          duration: v.duration || null,
          views: v.views ?? null,
          likes: v.likes ?? null,
          comments: v.comments ?? null,
          privacy: v.privacy || null,
          fetched_at: ts,
        });
      }
    });
    tx();
    return { count: videos.length, supported: true, scrapedAt: ts };
  } finally {
    await releaseContext(profileKey);
  }
}

export function getVideos(accountId, { sort = 'recent' } = {}) {
  const order = sort === 'views' ? 'views DESC NULLS LAST' : 'id DESC';
  return db.prepare(`SELECT * FROM videos WHERE account_id = ? ORDER BY ${order}`).all(accountId);
}

export function topVideos(accountId, metric = 'views', limit = 10) {
  const col = ['views', 'likes', 'comments'].includes(metric) ? metric : 'views';
  return db.prepare(
    `SELECT video_id, title, thumbnail_url, ${col} AS value FROM videos
     WHERE account_id = ? AND ${col} IS NOT NULL ORDER BY ${col} DESC LIMIT ?`
  ).all(accountId, limit);
}

const upsertComment = db.prepare(`
  INSERT INTO comments (account_id, comment_id, video_id, video_title, author, author_avatar, text, likes, replied, published_text, fetched_at)
  VALUES (@account_id, @comment_id, @video_id, @video_title, @author, @author_avatar, @text, @likes, @replied, @published_text, @fetched_at)
  ON CONFLICT(account_id, comment_id) DO UPDATE SET
    text = excluded.text, likes = excluded.likes, replied = excluded.replied,
    published_text = excluded.published_text, fetched_at = excluded.fetched_at
`);

export async function refreshComments(accountId) {
  const account = getAccount(accountId);
  const platform = getPlatform(account.platform);
  if (!platform.supportsContent || !platform.fetchComments) return { count: 0, supported: false };
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    const comments = await platform.fetchComments(context, account);
    const ts = now();
    const tx = db.transaction(() => {
      for (const c of comments) {
        upsertComment.run({
          account_id: accountId,
          comment_id: c.commentId,
          video_id: c.videoId || null,
          video_title: c.videoTitle || null,
          author: c.author || null,
          author_avatar: c.authorAvatar || null,
          text: c.text || null,
          likes: c.likes ?? null,
          replied: c.replied ? 1 : 0,
          published_text: c.publishedText || null,
          fetched_at: ts,
        });
      }
    });
    tx();
    return { count: comments.length, supported: true, scrapedAt: ts };
  } finally {
    await releaseContext(profileKey);
  }
}

export function getComments(accountId) {
  return db.prepare('SELECT * FROM comments WHERE account_id = ? ORDER BY id DESC').all(accountId);
}

export async function replyComment(accountId, commentId, text) {
  const account = getAccount(accountId);
  const platform = getPlatform(account.platform);
  if (!platform.replyComment) throw new Error('Nền tảng chưa hỗ trợ trả lời bình luận qua tool');
  if (!text || !text.trim()) throw new Error('Nội dung trả lời trống');
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    await platform.replyComment(context, account, commentId, text.trim());
    db.prepare('UPDATE comments SET replied = 1 WHERE account_id = ? AND comment_id = ?').run(accountId, commentId);
    return { ok: true };
  } finally {
    await releaseContext(profileKey);
  }
}

export async function deleteComment(accountId, commentId) {
  const account = getAccount(accountId);
  const platform = getPlatform(account.platform);
  if (!platform.deleteComment) throw new Error('Nền tảng chưa hỗ trợ xóa bình luận qua tool');
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    await platform.deleteComment(context, account, commentId);
    db.prepare('DELETE FROM comments WHERE account_id = ? AND comment_id = ?').run(accountId, commentId);
    return { ok: true };
  } finally {
    await releaseContext(profileKey);
  }
}

export async function deleteVideo(accountId, videoId) {
  const account = getAccount(accountId);
  const platform = getPlatform(account.platform);
  if (!platform.deleteVideo) throw new Error('Nền tảng chưa hỗ trợ xóa video qua tool');
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    await platform.deleteVideo(context, account, videoId);
    db.prepare('DELETE FROM videos WHERE account_id = ? AND video_id = ?').run(accountId, videoId);
    return { ok: true };
  } finally {
    await releaseContext(profileKey);
  }
}

/**
 * Tải video: ưu tiên file gốc đã đăng qua tool (không cần trình duyệt);
 * nếu không có, thử tải qua Studio (chỉ chủ kênh, nặng).
 */
export async function downloadVideo(accountId, videoId) {
  const account = getAccount(accountId);
  // Đường nhanh: video này từng được đăng qua tool → còn file gốc.
  const job = db.prepare(
    "SELECT file_path, original_name FROM upload_jobs WHERE account_id = ? AND remote_url LIKE ? AND status = 'done' ORDER BY id DESC LIMIT 1"
  ).get(accountId, `%${videoId}%`);
  if (job && job.file_path && fs.existsSync(job.file_path)) {
    return { path: job.file_path, filename: job.original_name || `${videoId}.mp4`, cleanup: null };
  }
  const platform = getPlatform(account.platform);
  if (!platform.downloadVideo) throw new Error('Video không có sẵn file trên server và nền tảng chưa hỗ trợ tải qua tool');
  const dest = path.join(DEBUG_DIR, `dl_${videoId}_${Date.now()}.mp4`);
  const profileKey = accountKey(account);
  const context = await acquireContext(profileKey);
  try {
    await platform.downloadVideo(context, account, videoId, dest);
    return { path: dest, filename: `${videoId}.mp4`, cleanup: () => fs.rm(dest, { force: true }, () => {}) };
  } finally {
    await releaseContext(profileKey);
  }
}
