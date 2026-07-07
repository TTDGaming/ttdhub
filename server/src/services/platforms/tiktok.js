import path from 'node:path';
import { DEBUG_DIR } from '../../config.js';
import { sleep } from '../../util.js';

export const homeUrl = 'https://www.tiktok.com';
export const loginUrl = 'https://www.tiktok.com/login';
export const supportsContent = false; // tab Nội dung/Cộng đồng hiện chỉ hỗ trợ YouTube

export async function isLoggedIn(context) {
  const cookies = await context.cookies('https://www.tiktok.com');
  return cookies.some((c) => c.name === 'sessionid' && c.value);
}

/** Đọc thông tin user từ trang hồ sơ (@me tự chuyển hướng về handle thật). */
export async function fetchIdentity(context) {
  const info = await readProfile(context, 'https://www.tiktok.com/@me');
  if (!info?.user?.uniqueId) throw new Error('Không đọc được hồ sơ TikTok');
  return {
    externalId: info.user.id || info.user.uniqueId,
    name: info.user.nickname || info.user.uniqueId,
    handle: `@${info.user.uniqueId}`,
    avatarUrl: info.user.avatarThumb || null,
  };
}

export async function fetchStats(context, account) {
  const handle = (account.handle || '').replace(/^@?/, '@');
  const info = await readProfile(context, `https://www.tiktok.com/${handle}`);
  if (!info?.stats) return { views: null, followers: null, likes: null, videos: null };
  const s = info.stats;
  return {
    // TikTok không công bố tổng view của tài khoản — dùng tổng tim (heart) làm likes
    views: null,
    followers: s.followerCount ?? null,
    likes: s.heartCount ?? s.heart ?? null,
    videos: s.videoCount ?? null,
  };
}

async function readProfile(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2500);
    return await page.evaluate(() => {
      const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!el) return null;
      try {
        const data = JSON.parse(el.textContent);
        return data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo || null;
      } catch {
        return null;
      }
    });
  } finally {
    await page.close().catch(() => {});
  }
}

/** Upload qua TikTok Studio web. */
export async function upload(context, job, onProgress) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    if (/login/.test(page.url())) throw new Error('Phiên đăng nhập TikTok đã hết hạn — hãy kết nối lại');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    await fileInput.setInputFiles(job.file_path);
    onProgress?.(10);

    // Chờ video xử lý xong phía TikTok (editor caption xuất hiện)
    const caption = page
      .locator('.public-DraftEditor-content, div[contenteditable="true"]')
      .first();
    await caption.waitFor({ state: 'visible', timeout: 120000 });
    onProgress?.(40);

    // Điền caption (tiêu đề + mô tả + tags)
    const text = [job.title, job.description, job.tags ? job.tags.split(',').map((t) => `#${t.trim().replace(/^#/, '')}`).join(' ') : '']
      .filter(Boolean)
      .join('\n');
    await caption.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(text);
    onProgress?.(55);

    // Chờ nút Đăng bật (TikTok upload chạy nền sau khi chọn file)
    const postBtn = page
      .locator('[data-e2e="post_video_button"], button[data-e2e="post_video_button"]')
      .first();
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const enabled = await postBtn.isEnabled().catch(() => false);
      if (enabled) break;
      await sleep(3000);
    }
    onProgress?.(85);

    await postBtn.click({ timeout: 15000 });
    // Thành công: có modal xác nhận hoặc chuyển về trang quản lý nội dung
    await Promise.race([
      page.waitForURL(/tiktokstudio\/content/, { timeout: 60000 }),
      page.locator('[data-e2e="upload_done"], .modal-title').first().waitFor({ timeout: 60000 }),
    ]).catch(() => {});
    onProgress?.(100);
    return { remoteUrl: null };
  } catch (err) {
    await page.screenshot({ path: path.join(DEBUG_DIR, `tt_job_${job.id}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}
