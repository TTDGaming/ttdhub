import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db, now } from '../db.js';
import { MEDIA_DIR } from '../config.js';
import { httpError } from '../util.js';
import { enqueueTick } from '../services/queue.js';

export const uploadsRouter = express.Router();

const storage = multer.diskStorage({
  destination: MEDIA_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]+/g, '_').slice(-80);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 * 1024 }, // 20GB / file
});

/**
 * Tạo lô đăng video hàng loạt.
 * multipart/form-data:
 *  - files[]: các file video
 *  - payload: JSON { items: [{ fileIndex, title, description, tags, privacy, scheduleAt, accountIds: [] }] }
 * Mỗi (video × tài khoản) = 1 job trong hàng đợi.
 */
uploadsRouter.post('/', upload.array('files', 50), (req, res, next) => {
  let payload;
  try {
    payload = JSON.parse(req.body.payload || '{}');
  } catch {
    return next(httpError(400, 'payload không phải JSON hợp lệ'));
  }
  const files = req.files || [];
  const items = payload.items || [];
  if (!files.length || !items.length) return next(httpError(400, 'Thiếu file hoặc thông tin video'));

  const batch = db.prepare('INSERT INTO upload_batches (created_at) VALUES (?)').run(now());
  const batchId = Number(batch.lastInsertRowid);
  const insert = db.prepare(
    `INSERT INTO upload_jobs
     (batch_id, account_id, file_path, original_name, title, description, tags, privacy, schedule_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let jobCount = 0;
  const tx = db.transaction(() => {
    for (const item of items) {
      const file = files[item.fileIndex];
      if (!file) throw httpError(400, `fileIndex ${item.fileIndex} không có file tương ứng`);
      const accountIds = Array.isArray(item.accountIds) ? item.accountIds : [];
      if (!accountIds.length) throw httpError(400, `Video "${item.title}" chưa chọn kênh đăng`);
      for (const accountId of accountIds) {
        const acc = db.prepare("SELECT id FROM accounts WHERE id = ? AND status = 'active'").get(accountId);
        if (!acc) throw httpError(400, `Tài khoản ${accountId} không tồn tại hoặc chưa kết nối`);
        insert.run(
          batchId, accountId, file.path, file.originalname,
          item.title || path.parse(file.originalname).name,
          item.description || null,
          item.tags || null,
          ['public', 'unlisted', 'private'].includes(item.privacy) ? item.privacy : 'public',
          item.scheduleAt ? Number(item.scheduleAt) : null,
          now()
        );
        jobCount += 1;
      }
    }
  });
  try {
    tx();
  } catch (err) {
    for (const f of files) fs.rm(f.path, { force: true }, () => {});
    return next(err);
  }
  enqueueTick();
  res.json({ ok: true, batchId, jobCount });
});

uploadsRouter.get('/jobs', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 1000);
  const jobs = db
    .prepare(
      `SELECT j.*, a.name AS account_name, a.platform, a.avatar_url
       FROM upload_jobs j JOIN accounts a ON a.id = j.account_id
       ORDER BY j.id DESC LIMIT ?`
    )
    .all(limit);
  res.json(jobs);
});

uploadsRouter.post('/jobs/:id/retry', (req, res, next) => {
  const job = db.prepare('SELECT * FROM upload_jobs WHERE id = ?').get(req.params.id);
  if (!job) return next(httpError(404, 'Không tìm thấy job'));
  if (!['error', 'canceled'].includes(job.status)) return next(httpError(400, 'Chỉ chạy lại job lỗi/đã hủy'));
  db.prepare("UPDATE upload_jobs SET status = 'queued', progress = 0, error = NULL WHERE id = ?").run(job.id);
  enqueueTick();
  res.json({ ok: true });
});

uploadsRouter.post('/jobs/:id/cancel', (req, res, next) => {
  const job = db.prepare('SELECT * FROM upload_jobs WHERE id = ?').get(req.params.id);
  if (!job) return next(httpError(404, 'Không tìm thấy job'));
  if (job.status !== 'queued') return next(httpError(400, 'Chỉ hủy được job đang chờ'));
  db.prepare("UPDATE upload_jobs SET status = 'canceled' WHERE id = ?").run(job.id);
  res.json({ ok: true });
});

uploadsRouter.delete('/jobs/:id', (req, res, next) => {
  const job = db.prepare('SELECT * FROM upload_jobs WHERE id = ?').get(req.params.id);
  if (!job) return next(httpError(404, 'Không tìm thấy job'));
  if (['queued', 'uploading'].includes(job.status)) return next(httpError(400, 'Hủy job trước khi xóa'));
  db.prepare('DELETE FROM upload_jobs WHERE id = ?').run(job.id);
  // Xóa file nếu không còn job nào dùng
  const remain = db.prepare('SELECT COUNT(*) c FROM upload_jobs WHERE file_path = ?').get(job.file_path);
  if (remain.c === 0) fs.rm(job.file_path, { force: true }, () => {});
  res.json({ ok: true });
});
