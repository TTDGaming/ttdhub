# Quản lý MS Hub từ xa qua Cloudflare Tunnel

Cloudflare Tunnel cho phép truy cập MS Hub từ bất kỳ đâu mà **không cần mở port router,
không cần IP tĩnh**, kèm HTTPS miễn phí. WebSocket (trình duyệt đăng nhập từ xa) hoạt động
bình thường qua tunnel.

## 1. Cài cloudflared

- **Linux (Debian/Ubuntu):**
  ```bash
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
  sudo dpkg -i cloudflared.deb
  ```
- **Windows:** tải `cloudflared-windows-amd64.exe` từ
  https://github.com/cloudflare/cloudflared/releases, đổi tên thành `cloudflared.exe`
  và đặt vào thư mục trong PATH (hoặc cạnh `scripts\tunnel.bat`).

## 2. Tunnel tạm thời (nhanh nhất, không cần tài khoản)

```bash
cloudflared tunnel --url http://localhost:3689
```

Terminal sẽ in một URL dạng `https://xxxx.trycloudflare.com` — mở URL đó từ điện thoại/máy khác
là vào được MS Hub. URL đổi mỗi lần chạy lại.

> Có sẵn script: `scripts/tunnel.sh` (Linux) / `scripts\tunnel.bat` (Windows).

## 3. Tunnel cố định với tên miền riêng (khuyên dùng)

Yêu cầu: tên miền đã trỏ DNS về Cloudflare (gói miễn phí là đủ).

```bash
cloudflared tunnel login                 # mở trình duyệt xác thực Cloudflare
cloudflared tunnel create mshub          # tạo tunnel, sinh file credentials
cloudflared tunnel route dns mshub hub.tenmiencuaban.com
```

Tạo file cấu hình `~/.cloudflared/config.yml` (Windows: `%USERPROFILE%\.cloudflared\config.yml`):

```yaml
tunnel: mshub
credentials-file: /home/BAN/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: hub.tenmiencuaban.com
    service: http://localhost:3689
  - service: http_status:404
```

Chạy thử: `cloudflared tunnel run mshub` → mở `https://hub.tenmiencuaban.com`.

## 4. Chạy nền như service

- **Linux (systemd):**
  ```bash
  sudo cloudflared service install
  sudo systemctl enable --now cloudflared
  ```
- **Windows:**
  ```powershell
  cloudflared.exe service install
  ```

## 5. Bảo mật thêm (tùy chọn nhưng nên làm)

MS Hub đã có đăng nhập quản trị riêng, nhưng với tunnel cố định bạn nên chặn thêm một lớp
bằng **Cloudflare Access** (miễn phí tới 50 người dùng):

1. Vào Cloudflare Zero Trust → Access → Applications → Add application (Self-hosted).
2. Domain: `hub.tenmiencuaban.com`.
3. Policy: chỉ cho phép email của bạn.

Khi đó ai mở URL cũng phải xác thực qua Cloudflare trước khi thấy trang đăng nhập MS Hub.
