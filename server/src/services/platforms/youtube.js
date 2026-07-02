import path from 'node:path';
import { DEBUG_DIR } from '../../config.js';
import { parseCount, deepFind, sleep } from '../../util.js';

export const homeUrl = 'https://studio.youtube.com';
export const loginUrl =
  'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F';

export async function isLoggedIn(context) {
  const cookies = await context.cookies('https://www.youtube.com');
  return cookies.some((c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID');
}

/** Lấy channel ID + tên + avatar sau khi đăng nhập. */
export async function fetchIdentity(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForURL(/studio\.youtube\.com\/channel\/UC/, { timeout: 30000 });
    const channelId = page.url().match(/channel\/(UC[\w-]+)/)?.[1];
    if (!channelId) throw new Error('Không lấy được channel ID');
    const meta = await fetchChannelMeta(context, channelId);
    return {
      externalId: channelId,
      name: meta.name || 'Kênh YouTube',
      handle: meta.handle || null,
      avatarUrl: meta.avatar || null,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchChannelMeta(context, channelId) {
  const resp = await context.request.get(`https://www.youtube.com/channel/${channelId}`, {
    timeout: 30000,
  });
  const html = await resp.text();
  const name = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  const avatar = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const handle = html.match(/"canonicalBaseUrl":"\/(@[^"]+)"/)?.[1];
  return { name, avatar, handle };
}

/** Thu số liệu kênh: tổng view, subscriber, số video (từ trang about công khai). */
export async function fetchStats(context, account) {
  const page = await context.newPage();
  try {
    await page.goto(`https://www.youtube.com/channel/${account.external_id}/about`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(2500);
    const data = await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return typeof ytInitialData !== 'undefined' ? JSON.parse(JSON.stringify(ytInitialData)) : null;
    });
    let views = null, followers = null, videos = null;
    if (data) {
      const about = deepFind(data, 'aboutChannelViewModel');
      if (about) {
        views = parseCount(about.viewCountText);
        followers = parseCount(about.subscriberCountText);
        videos = parseCount(about.videoCountText);
      }
      if (followers == null) {
        const header = deepFind(data, 'subscriberCountText');
        followers = parseCount(typeof header === 'string' ? header : header?.simpleText);
      }
    }
    // Dự phòng: đọc từ HTML thô
    if (views == null || followers == null) {
      const html = await page.content();
      views ??= parseCount(html.match(/"viewCountText":"([^"]+)"/)?.[1]);
      followers ??= parseCount(html.match(/"subscriberCountText":"([^"]+)"/)?.[1]);
      videos ??= parseCount(html.match(/"videoCountText":"([^"]+)"/)?.[1]);
    }
    return { views, followers, likes: null, videos };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Upload video qua YouTube Studio — thao tác đúng như người dùng thật,
 * dùng selector theo id/name (không phụ thuộc ngôn ngữ giao diện).
 */
export async function upload(context, job, onProgress) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại kênh');
    }
    // Chọn file
    const fileInput = page.locator('ytcp-uploads-dialog input[type="file"], input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    await fileInput.setInputFiles(job.file_path);
    onProgress?.(5);

    // Điền tiêu đề & mô tả
    const titleBox = page.locator('#title-textarea #textbox, ytcp-social-suggestions-textbox#title-textarea #textbox').first();
    await titleBox.waitFor({ state: 'visible', timeout: 60000 });
    await titleBox.click();
    await page.keyboard.press('ControlOrMeta+a');
    await titleBox.fill(job.title);
    if (job.description) {
      const descBox = page.locator('#description-textarea #textbox').first();
      await descBox.click();
      await descBox.fill(job.description);
    }
    onProgress?.(15);

    // "Không dành cho trẻ em"
    const notMfk = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first();
    await notMfk.click({ timeout: 15000 }).catch(() => {});

    // Qua 3 bước tiếp theo tới phần hiển thị
    for (let i = 0; i < 3; i++) {
      await page.locator('#next-button').click({ timeout: 15000 });
      await sleep(800);
    }

    // Chế độ hiển thị
    const privacyName = { public: 'PUBLIC', unlisted: 'UNLISTED', private: 'PRIVATE' }[job.privacy] || 'PUBLIC';
    await page.locator(`tp-yt-paper-radio-button[name="${privacyName}"]`).first().click({ timeout: 15000 });
    onProgress?.(20);

    // Lấy link video từ hộp thoại
    let remoteUrl = null;
    try {
      const link = await page.locator('a.ytcp-video-info, ytcp-video-info a').first().getAttribute('href', { timeout: 5000 });
      if (link) remoteUrl = link.startsWith('http') ? link : `https://youtu.be${link.replace(/^.*\/watch\?v=/, '/')}`;
    } catch { /* không bắt buộc */ }

    // Chờ upload xong (theo dõi nhãn tiến trình của Studio)
    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      const label = await page
        .locator('.progress-label, span.progress-label')
        .first()
        .textContent({ timeout: 5000 })
        .catch(() => null);
      if (label) {
        const m = label.match(/(\d{1,3})\s?%/);
        if (m) onProgress?.(20 + Math.round((Number(m[1]) / 100) * 70));
        // Hết chữ "%" và không còn "Đang tải" => upload xong, đang xử lý
        if (!/%/.test(label) && !/upload|tải/i.test(label)) break;
        if (/checks complete|hoàn tất|complete/i.test(label)) break;
      }
      const doneBtn = page.locator('#done-button');
      const disabled = await doneBtn.getAttribute('disabled').catch(() => 'missing');
      if (disabled === null) break; // nút Done bật => có thể đăng
      await sleep(3000);
    }
    onProgress?.(92);

    await page.locator('#done-button').click({ timeout: 15000 });
    // Chờ hộp thoại đóng hoặc hộp "đã chia sẻ" hiện ra
    await page
      .locator('ytcp-uploads-still-processing-dialog, ytcp-uploads-dialog[hidden]')
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {});
    onProgress?.(100);
    return { remoteUrl };
  } catch (err) {
    await page.screenshot({ path: path.join(DEBUG_DIR, `yt_job_${job.id}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}
