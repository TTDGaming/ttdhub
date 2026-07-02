import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

// Khóa mã hóa token được sinh ngẫu nhiên ở lần chạy đầu và lưu trong data/.
// Mỗi tài khoản kết nối được mã hóa độc lập (AES-256-GCM, IV riêng) —
// đảm bảo cách ly dữ liệu giữa các tài khoản ngay ở tầng lưu trữ.
const KEY_PATH = path.join(DATA_DIR, 'secret.key');

function loadKey() {
  if (!fs.existsSync(KEY_PATH)) {
    fs.writeFileSync(KEY_PATH, crypto.randomBytes(32), { mode: 0o600 });
  }
  return fs.readFileSync(KEY_PATH);
}

const KEY = loadKey();

export function encrypt(plainText) {
  if (plainText == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload) {
  if (payload == null) return null;
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
