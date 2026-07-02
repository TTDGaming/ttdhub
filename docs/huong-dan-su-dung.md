# Hướng dẫn sử dụng MS Hub

## Lần chạy đầu

Mở `http://localhost:3689` (hoặc URL tunnel), tạo tài khoản quản trị. Tài khoản này chỉ dùng
để đăng nhập vào tool — không liên quan gì tới tài khoản mạng xã hội.

## Kết nối kênh

1. Vào **Kênh** → bấm **+ YouTube / + TikTok / + Facebook**.
2. Một cửa sổ trình duyệt hiện ra ngay trong web app — đây là Chromium chạy trên server,
   trong một **profile cách ly riêng** cho kênh này.
3. Đăng nhập tài khoản như bình thường (gõ trực tiếp vào khung; dán được bằng Ctrl+V; hỗ trợ 2FA).
4. Khi thấy nhãn **"Đã phát hiện đăng nhập"**, bấm **Hoàn tất** — tool tự nhận diện tên kênh,
   avatar và bắt đầu thu số liệu.

Lưu ý theo nền tảng:

- **YouTube**: nếu tài khoản Google có nhiều kênh, hãy chọn đúng kênh trong bước đăng nhập
  (Google hỏi "Chọn tài khoản/kênh").
- **Facebook (Trang/TCN)**: nếu muốn đăng cho Trang, sau khi đăng nhập hãy **chuyển sang vai Trang**
  (profile switch) rồi mới bấm Hoàn tất. Sau đó mở chi tiết kênh và điền **URL Trang**.
- **TikTok**: đăng nhập bằng bất kỳ phương thức nào TikTok hỗ trợ trên web.

Mỗi kênh một profile riêng nên bạn có thể kết nối **nhiều tài khoản cùng nền tảng** mà không
bị "đá" phiên lẫn nhau.

## Đăng video hàng loạt

1. Vào **Đăng video**.
2. **Bước 1** — tick các kênh muốn đăng (được phép trộn YouTube + TikTok + Facebook).
3. **Bước 2** — thêm nhiều file video; mỗi video đặt tiêu đề, mô tả, tags, chế độ hiển thị
   (YouTube), và hẹn giờ nếu muốn. Có ô "mô tả chung" áp dụng cho video không có mô tả riêng.
4. **Bước 3** — bấm **Đưa vào hàng đợi**. File được tải lên server, sau đó tool tự đăng lần lượt
   lên từng kênh (mỗi video × mỗi kênh = 1 job).

Theo dõi ở trang **Hàng đợi**: tiến trình %, trạng thái, link video sau khi đăng xong.
Job lỗi có nút **Chạy lại** và thông báo lỗi cụ thể; server còn lưu ảnh chụp màn hình tại thời
điểm lỗi trong `data/debug/` để chẩn đoán.

## Số liệu & biểu đồ

- **Tổng quan**: tổng view 48h toàn hệ thống, biểu đồ view tăng theo giờ, bảng hiệu suất
  từng kênh kèm sparkline.
- **Chi tiết kênh** (bấm vào kênh): biểu đồ follower / tổng view / lượt thích theo
  48 giờ · 7 · 30 · 90 ngày; nút **Lấy số liệu ngay** để cập nhật tức thì.
- Số liệu tự thu **mỗi 30 phút** (đổi bằng `MSHUB_POLL_INTERVAL_MIN`). Biểu đồ 48h cần chạy
  tool liên tục ít nhất vài giờ để có dữ liệu — nên chạy server 24/7 hoặc dùng Docker.

Chỉ số theo nền tảng: YouTube có tổng view + subscriber + số video; TikTok có follower +
tổng tim + số video (TikTok không công bố tổng view tài khoản); Facebook có follower + likes
của Trang.

## Gỡ kênh

Chi tiết kênh → **Gỡ kênh**: xóa vĩnh viễn profile trình duyệt (toàn bộ cookie đăng nhập),
số liệu và job của kênh đó trên server. Tài khoản thật của bạn không bị ảnh hưởng.
