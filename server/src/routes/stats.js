import express from 'express';
import { db } from '../db.js';
import { httpError } from '../util.js';

export const statsRouter = express.Router();

const RANGES = {
  '48h': 48 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
  '90d': 90 * 24 * 3600 * 1000,
};

/** Tổng quan toàn hệ thống cho dashboard. */
statsRouter.get('/overview', (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE status = 'active'").all();
  const cutoff = Date.now() - 48 * 3600 * 1000;

  let totalViews = 0, totalFollowers = 0, views48h = 0, followers48h = 0;
  const perAccount = accounts.map((acc) => {
    const latest = db
      .prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at DESC LIMIT 1')
      .get(acc.id);
    const base =
      db.prepare(
        'SELECT * FROM stat_snapshots WHERE account_id = ? AND taken_at <= ? ORDER BY taken_at DESC LIMIT 1'
      ).get(acc.id, cutoff) ||
      db.prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at ASC LIMIT 1').get(acc.id);

    const v48 = latest && base && latest.id !== base.id && latest.views != null && base.views != null
      ? latest.views - base.views : 0;
    const f48 = latest && base && latest.id !== base.id && latest.followers != null && base.followers != null
      ? latest.followers - base.followers : 0;

    totalViews += latest?.views || 0;
    totalFollowers += latest?.followers || 0;
    views48h += v48;
    followers48h += f48;

    // Sparkline 48h: chuỗi view (hoặc follower nếu nền tảng không có view)
    const series = db
      .prepare(
        'SELECT taken_at, views, followers, likes FROM stat_snapshots WHERE account_id = ? AND taken_at >= ? ORDER BY taken_at ASC'
      )
      .all(acc.id, cutoff);

    return {
      id: acc.id,
      platform: acc.platform,
      name: acc.name,
      handle: acc.handle,
      avatarUrl: acc.avatar_url,
      views: latest?.views ?? null,
      followers: latest?.followers ?? null,
      likes: latest?.likes ?? null,
      views48h: v48,
      followers48h: f48,
      spark: series.map((s) => ({ t: s.taken_at, v: s.views ?? s.likes ?? s.followers ?? 0 })),
    };
  });

  const jobs = db.prepare(
    `SELECT
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) queued,
       SUM(CASE WHEN status = 'uploading' THEN 1 ELSE 0 END) uploading,
       SUM(CASE WHEN status = 'done' AND finished_at >= ? THEN 1 ELSE 0 END) done48h,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) errors
     FROM upload_jobs`
  ).get(cutoff);

  res.json({
    accountCount: accounts.length,
    totalViews,
    totalFollowers,
    views48h,
    followers48h,
    jobs: {
      queued: jobs.queued || 0,
      uploading: jobs.uploading || 0,
      done48h: jobs.done48h || 0,
      errors: jobs.errors || 0,
    },
    accounts: perAccount,
  });
});

/** Chuỗi thời gian của một tài khoản để vẽ biểu đồ chi tiết. */
statsRouter.get('/accounts/:id/history', (req, res, next) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(httpError(404, 'Không tìm thấy tài khoản'));
  const rangeMs = RANGES[req.query.range] || RANGES['48h'];
  const cutoff = Date.now() - rangeMs;
  const rows = db
    .prepare(
      'SELECT taken_at, views, followers, likes, videos FROM stat_snapshots WHERE account_id = ? AND taken_at >= ? ORDER BY taken_at ASC'
    )
    .all(account.id, cutoff);
  res.json({
    account: { id: account.id, name: account.name, platform: account.platform },
    range: req.query.range || '48h',
    points: rows.map((r) => ({
      t: r.taken_at, views: r.views, followers: r.followers, likes: r.likes, videos: r.videos,
    })),
  });
});
