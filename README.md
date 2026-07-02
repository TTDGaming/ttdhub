# MS Hub — Quản lý đa kênh YouTube · TikTok · Facebook

Tool web tự host giúp quản lý **nhiều kênh trên nhiều nền tảng trong một giao diện duy nhất**:
đăng nhập kênh ngay trong tool qua trình duyệt nhúng, đăng video hàng loạt, theo dõi số liệu
và biểu đồ view 48 giờ của từng kênh — **không cần API key, không cần đụng vào trang quản lý gốc**.

## Tính năng

- **Kết nối kênh bằng đăng nhập thật**: bấm "+ YouTube / TikTok / Facebook", một trình duyệt
  Chromium chạy trên server hiện ra ngay trong web app (stream qua WebSocket) — bạn đăng nhập
  như bình thường (hỗ trợ cả 2FA), tool tự nhận diện kênh và lưu phiên.
- **Cách ly tuyệt đối giữa các tài khoản**: mỗi kênh có một profile trình duyệt riêng
  (cookie, cache, localStorage tách biệt hoàn toàn) — an toàn khi quản lý nhiều tài khoản cùng nền tảng.
- **Đăng video hàng loạt**: chọn nhiều video × nhiều kênh, đặt tiêu đề/mô tả/tags/chế độ hiển thị,
  hẹn giờ đăng; hàng đợi tự chạy tuần tự với tiến trình realtime, job lỗi có ảnh chụp màn hình để tra cứu.
- **Số liệu & biểu đồ**: tổng quan toàn hệ thống, view tăng theo giờ trong 48h, sparkline từng kênh,
  biểu đồ follower/view/likes theo 48h · 7 · 30 · 90 ngày. Số liệu tự thu mỗi 30 phút.
- **Quản lý từ xa**: chạy trên Linux/Windows, truy cập qua trình duyệt; hỗ trợ Cloudflare Tunnel
  (không cần mở port, không cần IP tĩnh).
- **Bảo mật**: đăng nhập quản trị bắt buộc, cookie phiên HttpOnly, dữ liệu lưu 100% cục bộ.

## Cài đặt

Yêu cầu: [Node.js ≥ 20](https://nodejs.org) (Linux hoặc Windows).

```bash
git clone <repo-url> && cd ttdhub
npm run setup                      # cài dependencies cho server + web
npx --prefix server playwright install --with-deps chromium   # tải Chromium cho trình duyệt nhúng
npm run build                      # build giao diện
npm start                          # chạy — mở http://localhost:3689
```

Trên Windows dùng `scripts\start.bat`, trên Linux dùng `scripts/start.sh` (tự làm các bước trên).

Lần đầu mở web, tool sẽ yêu cầu tạo tài khoản quản trị.

### Chạy bằng Docker (Linux)

```bash
docker compose up -d               # web ở cổng 3689, dữ liệu trong ./data
```

## Truy cập từ xa qua Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3689     # tunnel tạm, có URL ngay
```

Tunnel cố định với tên miền riêng + chạy nền như service: xem [docs/cloudflare-tunnel.md](docs/cloudflare-tunnel.md).

## Hướng dẫn sử dụng

Xem [docs/huong-dan-su-dung.md](docs/huong-dan-su-dung.md) — kết nối kênh, đăng hàng loạt, đọc số liệu.

## Cấu hình (biến môi trường, đều có mặc định hợp lý)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3689` | Cổng web |
| `MSHUB_DATA_DIR` | `./data` | Nơi lưu database, profile trình duyệt, video chờ đăng |
| `MSHUB_UPLOAD_CONCURRENCY` | `2` | Số job đăng chạy song song |
| `MSHUB_POLL_INTERVAL_MIN` | `30` | Chu kỳ thu số liệu (phút) |
| `MSHUB_CHROME_PATH` | *(tự tìm)* | Đường dẫn Chromium tùy chỉnh |
| `MSHUB_PROXY` | *(không)* | Proxy cho trình duyệt nhúng (mạng doanh nghiệp) |

## Kiến trúc

```
server/   Node.js + Express + SQLite (better-sqlite3)
          ├─ Playwright điều khiển Chromium — mỗi tài khoản một profile cách ly
          ├─ Phiên đăng nhập từ xa: CDP screencast → WebSocket → canvas trong web app
          ├─ Hàng đợi đăng video (tuần tự theo kênh, song song giữa các kênh)
          └─ Bộ thu số liệu định kỳ → snapshot → biểu đồ 48h/7d/30d/90d
web/      React + Vite + Tailwind + Recharts (giao diện tiếng Việt)
data/     Dữ liệu runtime (KHÔNG commit): mshub.db, profiles/, media/, debug/
```

## Lưu ý quan trọng

- Tool thao tác giao diện web của các nền tảng như người dùng thật. Khi nền tảng đổi giao diện,
  flow đăng video có thể cần cập nhật selector (xem `server/src/services/platforms/`).
  Job lỗi luôn kèm ảnh chụp màn hình trong `data/debug/` để chẩn đoán nhanh.
- Đăng tự động qua giao diện có thể trái điều khoản của nền tảng — chỉ dùng với các kênh
  **thuộc sở hữu của bạn** và ở tần suất hợp lý.
- Flow Facebook Page phụ thuộc giao diện Facebook (thay đổi thường xuyên) — trạng thái: thử nghiệm.
- Sao lưu: chỉ cần copy thư mục `data/`.
