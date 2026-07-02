import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { PROFILES_DIR, CHROME_PATH } from '../config.js';

/**
 * Quản lý trình duyệt cách ly theo "profile key".
 *
 * - Kênh độc lập (đăng nhập trực tiếp): profile key = `acc_<accountId>`.
 * - Kênh thuộc một tài khoản quản lý (identity): các kênh cùng identity dùng
 *   chung profile `id_<identityId>` (một lần đăng nhập Google quản lý nhiều kênh).
 *
 * Mỗi profile là một thư mục Chromium riêng — cookie/localStorage/cache tách biệt
 * hoàn toàn giữa các identity/kênh khác nhau.
 */

const contexts = new Map(); // profileKey -> { context, refs }

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
  const proxy = process.env.MSHUB_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) opts.proxy = { server: proxy };
  return opts;
}

/** Profile key cho một identity (nhiều kênh dùng chung). */
export const identityKey = (identityId) => `id_${identityId}`;

/** Profile key cho một bản ghi account (row từ bảng accounts). */
export function accountKey(account) {
  if (account && account.identity_id) return identityKey(account.identity_id);
  const id = typeof account === 'object' ? account.id : account;
  return `acc_${id}`;
}

export function profileDir(profileKey) {
  return path.join(PROFILES_DIR, profileKey);
}

/** Mở (hoặc dùng lại) context trình duyệt của một profile. Nhớ gọi release. */
export async function acquireContext(profileKey) {
  let entry = contexts.get(profileKey);
  if (entry) {
    entry.refs += 1;
    return entry.context;
  }
  const context = await chromium.launchPersistentContext(profileDir(profileKey), launchOptions());
  entry = { context, refs: 1 };
  contexts.set(profileKey, entry);
  context.on('close', () => contexts.delete(profileKey));
  return context;
}

export async function releaseContext(profileKey) {
  const entry = contexts.get(profileKey);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    contexts.delete(profileKey);
    await entry.context.close().catch(() => {});
  }
}

export async function destroyProfile(profileKey) {
  const entry = contexts.get(profileKey);
  if (entry) {
    contexts.delete(profileKey);
    await entry.context.close().catch(() => {});
  }
  fs.rmSync(profileDir(profileKey), { recursive: true, force: true });
}

export async function closeAll() {
  for (const [key, entry] of contexts) {
    contexts.delete(key);
    await entry.context.close().catch(() => {});
  }
}
