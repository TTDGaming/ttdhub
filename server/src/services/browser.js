import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { PROFILES_DIR, CHROME_PATH } from '../config.js';

/**
 * Quản lý trình duyệt cách ly theo tài khoản.
 * Mỗi tài khoản = một thư mục profile Chromium riêng (cookie, localStorage,
 * cache hoàn toàn tách biệt). Không tài khoản nào nhìn thấy dữ liệu của
 * tài khoản khác — kể cả khi cùng nền tảng.
 */

const contexts = new Map(); // accountId -> { context, refs }

function launchOptions() {
  const opts = {
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
    ],
  };
  if (CHROME_PATH && fs.existsSync(CHROME_PATH)) opts.executablePath = CHROME_PATH;
  else if (fs.existsSync('/opt/pw-browsers/chromium')) opts.executablePath = '/opt/pw-browsers/chromium';
  // Môi trường doanh nghiệp: cho trình duyệt nhúng đi qua proxy hệ thống nếu có
  const proxy = process.env.MSHUB_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) opts.proxy = { server: proxy };
  return opts;
}

export function profileDir(accountId) {
  return path.join(PROFILES_DIR, `acc_${accountId}`);
}

/** Mở (hoặc dùng lại) context trình duyệt của một tài khoản. Nhớ gọi release. */
export async function acquireContext(accountId) {
  let entry = contexts.get(accountId);
  if (entry) {
    entry.refs += 1;
    return entry.context;
  }
  const context = await chromium.launchPersistentContext(profileDir(accountId), launchOptions());
  entry = { context, refs: 1 };
  contexts.set(accountId, entry);
  context.on('close', () => contexts.delete(accountId));
  return context;
}

export async function releaseContext(accountId) {
  const entry = contexts.get(accountId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    contexts.delete(accountId);
    await entry.context.close().catch(() => {});
  }
}

export async function destroyProfile(accountId) {
  const entry = contexts.get(accountId);
  if (entry) {
    contexts.delete(accountId);
    await entry.context.close().catch(() => {});
  }
  fs.rmSync(profileDir(accountId), { recursive: true, force: true });
}

export async function closeAll() {
  for (const [id, entry] of contexts) {
    contexts.delete(id);
    await entry.context.close().catch(() => {});
  }
}
