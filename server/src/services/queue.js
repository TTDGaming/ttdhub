import fs from 'node:fs';
import { db, now } from '../db.js';
import { UPLOAD_CONCURRENCY } from '../config.js';
import { acquireContext, releaseContext, accountKey } from './browser.js';
import { getPlatform } from './platforms/index.js';

/**
 * Hàng đợi đăng video: chạy tối đa UPLOAD_CONCURRENCY job song song,
 * nhưng mỗi tài khoản chỉ chạy 1 job một lúc (tránh 2 phiên đụng nhau
 * trong cùng một profile trình duyệt).
 */

const runningJobs = new Set();      // job.id đang chạy
const busyProfiles = new Set();     // profileKey đang có job chạy (mỗi profile chỉ 1 job)
let ticking = false;

export function enqueueTick() {
  setImmediate(tick);
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    while (runningJobs.size < UPLOAD_CONCURRENCY) {
      const job = pickNextJob();
      if (!job) break;
      runJob(job); // không await — chạy nền
    }
  } finally {
    ticking = false;
  }
}

function pickNextJob() {
  const rows = db
    .prepare(
      `SELECT j.*, a.platform, a.page_url, a.handle, a.external_id, a.identity_id, a.status AS account_status,
              i.status AS identity_status
       FROM upload_jobs j JOIN accounts a ON a.id = j.account_id
       LEFT JOIN identities i ON i.id = a.identity_id
       WHERE j.status = 'queued' AND (j.schedule_at IS NULL OR j.schedule_at <= ?)
       ORDER BY j.id ASC`
    )
    .all(now());
  return rows.find((r) => {
    if (r.account_status !== 'active') return false;
    if (r.identity_id && r.identity_status && r.identity_status !== 'active') return false;
    const key = accountKey(r);
    return !busyProfiles.has(key);
  }) || null;
}

async function runJob(job) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(job.account_id);
  job._account = account;
  const profileKey = accountKey(account);
  runningJobs.add(job.id);
  busyProfiles.add(profileKey);
  db.prepare("UPDATE upload_jobs SET status = 'uploading', progress = 1, started_at = ?, error = NULL WHERE id = ?")
    .run(now(), job.id);
  let context = null;
  try {
    if (!fs.existsSync(job.file_path)) throw new Error('File video không còn tồn tại trên server');
    const platform = getPlatform(job.platform);
    context = await acquireContext(profileKey);

    const onProgress = (p) => {
      const cur = db.prepare('SELECT status FROM upload_jobs WHERE id = ?').get(job.id);
      if (cur?.status === 'uploading') {
        db.prepare('UPDATE upload_jobs SET progress = ? WHERE id = ?').run(Math.min(99, Math.round(p)), job.id);
      }
    };

    const result = await platform.upload(context, job, onProgress);
    db.prepare(
      "UPDATE upload_jobs SET status = 'done', progress = 100, remote_url = ?, finished_at = ? WHERE id = ?"
    ).run(result?.remoteUrl || null, now(), job.id);
  } catch (err) {
    const message = String(err?.message || err);
    db.prepare("UPDATE upload_jobs SET status = 'error', error = ?, finished_at = ? WHERE id = ?").run(
      message.slice(0, 2000), now(), job.id
    );
    // Phiên hết hạn → đánh dấu cần đăng nhập lại. Với kênh được quản lý thì đánh
    // dấu cả identity (mọi kênh của tài khoản quản lý tạm dừng).
    if (/hết hạn/i.test(message)) {
      db.prepare("UPDATE accounts SET status = 'error' WHERE id = ?").run(job.account_id);
      if (account?.identity_id) {
        db.prepare("UPDATE identities SET status = 'error' WHERE id = ?").run(account.identity_id);
      }
    }
  } finally {
    if (context) await releaseContext(profileKey);
    runningJobs.delete(job.id);
    busyProfiles.delete(profileKey);
    enqueueTick();
  }
}

export function startQueue() {
  // Job đang "uploading" từ lần chạy trước = bị ngắt giữa chừng → cho chạy lại
  db.prepare("UPDATE upload_jobs SET status = 'queued', progress = 0 WHERE status = 'uploading'").run();
  enqueueTick();
  // Quét định kỳ để bắt các job hẹn giờ
  setInterval(enqueueTick, 30 * 1000);
}
