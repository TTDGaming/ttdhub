import express from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../util.js';
import * as content from '../services/content.js';

export const contentRouter = express.Router();

function loadAccount(req) {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!acc) throw httpError(404, 'Không tìm thấy kênh');
  return acc;
}

function mapVideo(v) {
  return {
    id: v.id,
    externalId: v.video_id,
    title: v.title,
    thumbnailUrl: v.thumbnail_url,
    url: v.url,
    publishedAt: v.published_at,
    publishedText: v.published_text,
    duration: v.duration,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    privacy: v.privacy,
    scrapedAt: v.fetched_at,
  };
}

// ---- Video (tab Nội dung) ----
contentRouter.get('/:id/videos', (req, res) => {
  const acc = loadAccount(req);
  const rows = content.getVideos(acc.id, { sort: req.query.sort });
  res.json({
    account: { id: acc.id, platform: acc.platform },
    supported: content.isSupported(acc),
    videos: rows.map(mapVideo),
    scrapedAt: rows[0]?.fetched_at || null,
  });
});

contentRouter.post('/:id/videos/refresh', asyncHandler(async (req, res) => {
  const acc = loadAccount(req);
  const r = await content.refreshVideos(acc.id);
  res.json({ ok: true, ...r });
}));

contentRouter.get('/:id/videos/top', (req, res) => {
  const acc = loadAccount(req);
  const metric = req.query.metric || 'views';
  res.json({ metric, videos: content.topVideos(acc.id, metric, Number(req.query.limit || 10)) });
});

contentRouter.delete('/:id/videos/:videoId', asyncHandler(async (req, res) => {
  const acc = loadAccount(req);
  await content.deleteVideo(acc.id, req.params.videoId);
  res.json({ ok: true });
}));

contentRouter.get('/:id/videos/:videoId/download', asyncHandler(async (req, res) => {
  const acc = loadAccount(req);
  const file = await content.downloadVideo(acc.id, req.params.videoId);
  res.download(file.path, file.filename, (err) => {
    if (file.cleanup) file.cleanup();
    if (err && !res.headersSent) res.status(500).end();
  });
}));

// ---- Bình luận (tab Cộng đồng) ----
contentRouter.get('/:id/comments', (req, res) => {
  const acc = loadAccount(req);
  const rows = content.getComments(acc.id);
  res.json({
    account: { id: acc.id, platform: acc.platform },
    supported: content.isSupported(acc),
    comments: rows.map((c) => ({
      id: c.id,
      externalId: c.comment_id,
      videoTitle: c.video_title,
      author: c.author,
      authorAvatar: c.author_avatar,
      text: c.text,
      likes: c.likes,
      replied: !!c.replied,
      publishedText: c.published_text,
      scrapedAt: c.fetched_at,
    })),
    scrapedAt: rows[0]?.fetched_at || null,
  });
});

contentRouter.post('/:id/comments/refresh', asyncHandler(async (req, res) => {
  const acc = loadAccount(req);
  const r = await content.refreshComments(acc.id);
  res.json({ ok: true, ...r });
}));
