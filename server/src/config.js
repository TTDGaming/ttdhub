import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const DATA_DIR = process.env.MSHUB_DATA_DIR || path.join(ROOT_DIR, 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
export const DEBUG_DIR = path.join(DATA_DIR, 'debug');
export const DB_PATH = path.join(DATA_DIR, 'mshub.db');
export const WEB_DIST = path.join(ROOT_DIR, 'web', 'dist');
export const PORT = Number(process.env.PORT || 3689);
export const HOST = process.env.HOST || '0.0.0.0';

// Đường dẫn Chromium: ưu tiên biến môi trường, sau đó để Playwright tự tìm.
export const CHROME_PATH = process.env.MSHUB_CHROME_PATH || null;

// Số job upload chạy song song (mỗi tài khoản luôn chỉ chạy 1 job một lúc)
export const UPLOAD_CONCURRENCY = Number(process.env.MSHUB_UPLOAD_CONCURRENCY || 2);
// Chu kỳ tự thu thập số liệu (phút)
export const POLL_INTERVAL_MIN = Number(process.env.MSHUB_POLL_INTERVAL_MIN || 30);

for (const dir of [DATA_DIR, MEDIA_DIR, PROFILES_DIR, DEBUG_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
