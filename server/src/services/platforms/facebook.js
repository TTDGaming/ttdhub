import path from 'node:path';
import { DEBUG_DIR } from '../../config.js';
import { parseCount, sleep } from '../../util.js';

export const loginUrl = 'https://www.facebook.com/login';

export async function isLoggedIn(context) {
  const cookies = await context.cookies('https://www.facebook.com');
  return cookies.some((c) => c.name === 'c_user' && c.value);
}

export async function fetchIdentity(context) {
  const cookies = await context.cookies('https://www.facebook.com');
  const userId = cookies.find((c) => c.name === 'c_user')?.value;
  if (!userId) throw new Error('Chưa đăng nhập Facebook');
  let name = null;
  try {
    const resp = await context.request.get('https://www.facebook.com/me', { timeout: 30000, maxRedirects: 5 });
    const html = await resp.text();
    name = html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.replace(/\s*\|\s*Facebook.*/i, '').trim() || null;
  } catch { /* bỏ qua */ }
  return {
    externalId: userId,
    name: name || `Facebook ${userId}`,
    handle: null,
    avatarUrl: `https://graph.facebook.com/${userId}/picture?type=normal`,
  };
}

/**
 * Số liệu Trang: đọc số người theo dõi từ trang công khai (page_url).
 * Lưu ý: giao diện Facebook thay đổi thường xuyên nên phần này là best-effort.
 */
export async function fetchStats(context, account) {
  if (!account.page_url) return { views: null, followers: null, likes: null, videos: null };
  const page = await context.newPage();
  try {
    await page.goto(account.page_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    const body = await page.evaluate(() => document.body.innerText);
    const followers =
      parseCount(body.match(/([\d.,]+\s*(K|M|Tr|nghìn|triệu)?)\s*(người theo dõi|followers)/i)?.[1]) ?? null;
    const likes = parseCount(body.match(/([\d.,]+\s*(K|M|Tr|nghìn|triệu)?)\s*(lượt thích|likes)/i)?.[1]) ?? null;
    return { views: null, followers, likes, videos: null };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Đăng video lên Trang/TCN qua giao diện web.
 * Yêu cầu: tài khoản đã chuyển sang vai Trang (profile switch) khi đăng nhập,
 * hoặc page_url là trang mà tài khoản có quyền đăng.
 */
export async function upload(context, job, onProgress) {
  const account = job._account;
  if (!account?.page_url) {
    throw new Error('Tài khoản Facebook cần đặt "URL Trang" trước khi đăng (mở chi tiết kênh để đặt)');
  }
  const page = await context.newPage();
  try {
    await page.goto(account.page_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    if (/login/.test(page.url())) throw new Error('Phiên đăng nhập Facebook đã hết hạn — hãy kết nối lại');

    // Mở hộp soạn bài: khu vực "Bạn đang nghĩ gì?"
    const composer = page
      .locator('div[role="button"]:has-text("Bạn viết gì đi"), div[role="button"]:has-text("Bạn đang nghĩ gì"), div[role="button"]:has-text("What\'s on your mind")')
      .first();
    await composer.click({ timeout: 20000 });
    onProgress?.(10);

    const dialog = page.locator('div[role="dialog"]').last();
    await dialog.waitFor({ state: 'visible', timeout: 20000 });

    // Đính kèm video qua input file trong hộp thoại
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20000 }).catch(() => [null]),
      dialog
        .locator('div[aria-label*="nh/video"], div[aria-label*="hoto/video"], div[aria-label*="Photo"], div[aria-label*="Ảnh"]')
        .first()
        .click({ timeout: 15000 }),
    ]);
    if (chooser && typeof chooser.setFiles === 'function') {
      await chooser.setFiles(job.file_path);
    } else {
      await dialog.locator('input[type="file"]').first().setInputFiles(job.file_path, { timeout: 15000 });
    }
    onProgress?.(30);

    // Nội dung bài đăng
    const textbox = dialog.locator('div[role="textbox"]').first();
    await textbox.click({ timeout: 15000 });
    await page.keyboard.insertText([job.title, job.description].filter(Boolean).join('\n'));
    onProgress?.(45);

    // Nút Đăng
    const postBtn = dialog
      .locator('div[aria-label="Đăng"], div[aria-label="Post"], div[role="button"]:has-text("Đăng")')
      .first();
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const enabled = await postBtn.isEnabled().catch(() => false);
      const ariaDisabled = await postBtn.getAttribute('aria-disabled').catch(() => null);
      if (enabled && ariaDisabled !== 'true') break;
      await sleep(3000);
    }
    await postBtn.click({ timeout: 15000 });
    onProgress?.(80);

    // Chờ hộp thoại đóng (video có thể tiếp tục xử lý phía Facebook)
    await dialog.waitFor({ state: 'hidden', timeout: 10 * 60 * 1000 }).catch(() => {});
    onProgress?.(100);
    return { remoteUrl: account.page_url };
  } catch (err) {
    await page.screenshot({ path: path.join(DEBUG_DIR, `fb_job_${job.id}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}
