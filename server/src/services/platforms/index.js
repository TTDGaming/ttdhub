import * as youtube from './youtube.js';
import * as tiktok from './tiktok.js';
import * as facebook from './facebook.js';

export const platforms = { youtube, tiktok, facebook };

export function getPlatform(name) {
  const p = platforms[name];
  if (!p) throw new Error(`Nền tảng không hỗ trợ: ${name}`);
  return p;
}
