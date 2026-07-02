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
  // Kênh được quản lý (identity đăng nhập là Người quản lý): chuyển kênh đang
  // hoạt động sang đúng kênh đích trước khi đăng. KHÔNG nuốt lỗi — nếu chuyển
  // kênh thất bại, để job báo lỗi thay vì đăng nhầm sang kênh khác.
  await switchToChannel(context, job._account);
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

// ============================================================================
//  MÔ HÌNH "TÀI KHOẢN QUẢN LÝ" — một Google login quản lý nhiều kênh
// ============================================================================
// Một tài khoản Google được cấp vai trò Người quản lý cho nhiều kênh (qua
// quyền Kênh thương hiệu của YouTube). Từ một lần đăng nhập, tool tự phát hiện
// tất cả kênh mà tài khoản có quyền và thao tác trên từng kênh.
//
// LƯU Ý TRUNG THỰC: phần này dùng các endpoint/nội bộ KHÔNG được YouTube
// công bố (accounts_list, account switcher, thao tác Studio). YouTube đổi giao
// diện thường xuyên nên có thể cần cập nhật. Việc thu số liệu công khai
// (fetchStats/fetchVideos qua trang /channel/<id>) hoạt động độc lập, ổn định hơn.

export const supportsContent = true;

/** Danh sách kênh mà tài khoản đăng nhập có thể quản lý. */
export async function discoverChannels(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại');
    }

    // Gọi accounts_list ngay trong trang (tự ký SAPISIDHASH từ cookie).
    const raw = await page.evaluate(async () => {
      function readCookie(name) {
        const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
        return m ? m[1] : null;
      }
      async function sapisidHash(origin) {
        const sid = readCookie('__Secure-3PAPISID') || readCookie('SAPISID');
        if (!sid) return null;
        const ts = Math.floor(Date.now() / 1000);
        const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${sid} ${origin}`));
        const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
        return `SAPISIDHASH ${ts}_${hex}`;
      }
      const cfg = (window.ytcfg && window.ytcfg.data_) || {};
      const key = cfg.INNERTUBE_API_KEY;
      const ctx = cfg.INNERTUBE_CONTEXT;
      if (!key || !ctx) return null;
      const auth = await sapisidHash('https://www.youtube.com');
      const res = await fetch(`/youtubei/v1/account/accounts_list?key=${key}&prettyPrint=false`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth, 'X-Origin': 'https://www.youtube.com', 'X-Goog-AuthUser': '0' } : {}),
        },
        body: JSON.stringify({ context: ctx }),
      });
      if (!res.ok) return null;
      return await res.json();
    }).catch(() => null);

    let channels = raw ? parseAccountsList(raw) : [];

    // Dự phòng: đọc ytInitialData của trang chuyển tài khoản.
    if (!channels.length) {
      channels = await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        const data = typeof ytInitialData !== 'undefined' ? ytInitialData : null;
        if (!data) return [];
        const out = [];
        const walk = (o, d = 0) => {
          if (!o || typeof o !== 'object' || d > 40) return;
          if (o.accountItem || o.accountName) {
            const it = o.accountItem || o;
            const name = it.accountName?.simpleText || it.accountName?.runs?.[0]?.text;
            if (name) out.push({ name, photo: it.accountPhoto?.thumbnails?.slice(-1)?.[0]?.url || null });
          }
          for (const k of Object.keys(o)) walk(o[k], d + 1);
        };
        walk(data);
        return out;
      }).then((arr) => arr.map((a) => ({ name: a.name, avatarUrl: a.photo, handle: null, pageId: null, isSelf: false })));
    }

    // Loại trùng (đường dự phòng có thể lặp cùng một kênh).
    const seen = new Set();
    channels = channels.filter((c) => {
      const k = c.externalId || c.pageId || c.handle || c.name;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Resolve UCID từ @handle (trang công khai) cho các kênh có handle.
    for (const ch of channels) {
      if (!ch.externalId && ch.handle) {
        ch.externalId = await resolveChannelId(context, ch.handle).catch(() => null);
      }
    }
    return channels;
  } finally {
    await page.close().catch(() => {});
  }
}

function parseAccountsList(json) {
  const out = [];
  const walk = (o, d = 0) => {
    if (!o || typeof o !== 'object' || d > 40) return;
    if (o.accountItem) {
      const it = o.accountItem;
      const name = it.accountName?.simpleText || it.accountName?.runs?.[0]?.text || null;
      const handle = it.channelHandle?.simpleText || null;
      const avatar = it.accountPhoto?.thumbnails?.slice(-1)?.[0]?.url || null;
      const tokens = it.serviceEndpoint?.selectActiveIdentityEndpoint?.supportedTokens || [];
      let pageId = null;
      for (const t of tokens) {
        if (t.pageIdToken?.pageId) pageId = t.pageIdToken.pageId;
      }
      if (name) out.push({ name, handle, avatarUrl: avatar, pageId, isSelf: !!it.isSelected, externalId: null });
    }
    for (const k of Object.keys(o)) walk(o[k], d + 1);
  };
  walk(json);
  return out;
}

async function resolveChannelId(context, handle) {
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  const resp = await context.request.get(`https://www.youtube.com/${h}`, { timeout: 30000 });
  const html = await resp.text();
  return html.match(/"channelId":"(UC[\w-]+)"/)?.[1] || html.match(/channel\/(UC[\w-]+)/)?.[1] || null;
}

/** URL trang công khai của kênh (ưu tiên UCID, sau đó @handle). */
function channelUrl(account, suffix = '') {
  if (account.external_id && account.external_id.startsWith('UC')) {
    return `https://www.youtube.com/channel/${account.external_id}${suffix}`;
  }
  if (account.handle) {
    const h = account.handle.startsWith('@') ? account.handle : `@${account.handle}`;
    return `https://www.youtube.com/${h}${suffix}`;
  }
  return null;
}

/** Chuyển kênh đang hoạt động sang kênh đích (chỉ cần cho kênh được quản lý). */
export async function switchToChannel(context, account) {
  if (!account || (!account.is_manager && !account.page_id)) return;
  const ucid = account.external_id && account.external_id.startsWith('UC') ? account.external_id : null;
  if (!ucid) return;
  const page = await context.newPage();
  try {
    await page.goto(`https://studio.youtube.com/channel/${ucid}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1500);
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại');
    }
  } finally {
    await page.close().catch(() => {});
  }
}

/** Danh sách video của kênh — đọc từ trang video công khai (ổn định, không cần login). */
export async function fetchVideos(context, account) {
  const base = channelUrl(account, '/videos');
  if (!base) return [];
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2500);
    const items = await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      const data = typeof ytInitialData !== 'undefined' ? ytInitialData : null;
      if (!data) return [];
      const out = [];
      const walk = (o, d = 0) => {
        if (!o || typeof o !== 'object' || d > 45) return;
        // Chỉ nhận video từ trang /videos của kênh (tránh bắt nhầm cấu trúc video khác).
        const v = o.richItemRenderer?.content?.videoRenderer || o.gridVideoRenderer || null;
        if (v && v.videoId) {
          out.push({
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || null,
            thumb: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null,
            viewsText: v.viewCountText?.simpleText || v.viewCountText?.runs?.map((r) => r.text).join('') || null,
            publishedText: v.publishedTimeText?.simpleText || null,
            duration: v.lengthText?.simpleText || null,
          });
        }
        for (const k of Object.keys(o)) walk(o[k], d + 1);
      };
      walk(data);
      return out;
    });
    // Loại trùng theo videoId, giữ thứ tự
    const seen = new Set();
    return items
      .filter((v) => v.videoId && !seen.has(v.videoId) && seen.add(v.videoId))
      .map((v) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnailUrl: v.thumb,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        views: parseCount(v.viewsText),
        publishedText: v.publishedText,
        duration: v.duration,
        likes: null,
        comments: null,
        privacy: 'public',
      }));
  } finally {
    await page.close().catch(() => {});
  }
}

/** Bình luận gần đây — đọc từ hộp thư Studio (best-effort, cần login). */
export async function fetchComments(context, account) {
  const ucid = account.external_id && account.external_id.startsWith('UC') ? account.external_id : null;
  if (!ucid) return [];
  const page = await context.newPage();
  try {
    await page.goto(`https://studio.youtube.com/channel/${ucid}/comments/inbox`, {
      waitUntil: 'domcontentloaded', timeout: 60000,
    });
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại');
    }
    await sleep(3500);
    const rows = await page.$$eval('ytcp-comment-thread, ytcp-comment', (els) =>
      els.slice(0, 60).map((el) => ({
        commentId: el.getAttribute('comment-id') || el.id || null,
        author: el.querySelector('#author-text, #name')?.textContent?.trim() || null,
        authorAvatar: el.querySelector('img#img, img')?.getAttribute('src') || null,
        text: el.querySelector('#content-text, #comment-content')?.textContent?.trim() || null,
        published: el.querySelector('#published-time, .published-time-text')?.textContent?.trim() || null,
      }))
    ).catch(() => []);
    return rows
      .filter((r) => r.text)
      .map((r, i) => ({
        commentId: r.commentId || `c_${i}_${Date.now()}`,
        videoTitle: null,
        author: r.author,
        authorAvatar: r.authorAvatar,
        text: r.text,
        likes: null,
        publishedText: r.published,
      }));
  } finally {
    await page.close().catch(() => {});
  }
}

/** Xóa video qua Studio (best-effort). */
export async function deleteVideo(context, account, videoId) {
  await switchToChannel(context, account).catch(() => {});
  const page = await context.newPage();
  try {
    await page.goto(`https://studio.youtube.com/video/${videoId}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại');
    }
    await sleep(2500);
    await page.locator('#options-button, ytcp-video-metadata-editor #options-button').first().click({ timeout: 15000 });
    await page.locator('tp-yt-paper-item:has-text("Xóa"), tp-yt-paper-item:has-text("Delete")').first().click({ timeout: 10000 });
    await page.locator('#checkbox, ytcp-checkbox-lit').first().click({ timeout: 8000 }).catch(() => {});
    await page.locator('#confirm-button, ytcp-button:has-text("Xóa vĩnh viễn"), ytcp-button:has-text("Delete forever")').first().click({ timeout: 10000 });
    await sleep(2000);
    return { ok: true };
  } catch (err) {
    await page.screenshot({ path: path.join(DEBUG_DIR, `yt_delete_${videoId}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

/** Tải video xuống qua Studio (best-effort; owner mới tải được). */
export async function downloadVideo(context, account, videoId, destPath) {
  await switchToChannel(context, account).catch(() => {});
  const page = await context.newPage();
  try {
    await page.goto(`https://studio.youtube.com/video/${videoId}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/accounts\.google\.com/.test(page.url())) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn — hãy kết nối lại');
    }
    await sleep(2500);
    await page.locator('#options-button').first().click({ timeout: 15000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.locator('tp-yt-paper-item:has-text("Tải xuống"), tp-yt-paper-item:has-text("Download")').first().click({ timeout: 10000 }),
    ]);
    await download.saveAs(destPath);
    return { path: destPath };
  } catch (err) {
    await page.screenshot({ path: path.join(DEBUG_DIR, `yt_dl_${videoId}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}
