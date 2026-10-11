# Koax Script — hệ thống link trung gian

## Luồng hoạt động
1. Bấm **Get Script** → tạo mã link ngẫu nhiên 32 ký tự, ví dụ `gate.html?flow=1212...`.
2. Trang `gate.html` ràng buộc link với mã trình duyệt `koax-hwid`, sau đó chuyển đến `script.html?flow=...`.
3. `script.html` chỉ hiện nội dung sau khi xác minh; link trực tiếp, sai mã, link đã dùng hoặc hết hạn sẽ chuyển đến `access-denied.html`.
4. Link hết hạn sau 10 phút. Với Cloudflare Worker + KV, mỗi flow chỉ được xác thực thành công một lần; trang đã mở có thể refresh trong cùng tab.

## Quan trọng: GitHub Pages một mình không bảo mật được link dùng một lần
Mặc định `koax-config.js` để `API_BASE: ""`, tức chế độ demo chỉ lưu trạng thái trong browser storage. Chế độ này phù hợp để xem giao diện nhưng có thể bị vượt qua, sửa mã hoặc nhận link trung gian ở một browser khác.

Trình duyệt web không được phép đọc HWID vật lý thật của máy. `koax-hwid` là ID ngẫu nhiên lưu trong `localStorage` (định danh profile trình duyệt), không phải serial phần cứng; xóa dữ liệu trình duyệt sẽ làm ID này đổi. Backend bên dưới ràng buộc token với ID đó và ngăn dùng lại token phía server.

## Bật xác minh server với Cloudflare Workers + KV

1. Cài Node.js và Wrangler, đăng nhập Cloudflare:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. Tạo KV namespace:
   ```bash
   npx wrangler kv namespace create KOAX_FLOWS
   ```
3. Sao chép namespace ID kết quả vào `wrangler.toml`, thay `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
4. Trong `wrangler.toml`, sửa `ALLOWED_ORIGIN` thành origin website GitHub Pages của bạn (ví dụ `https://ten-tai-khoan.github.io`). Không thêm đường dẫn `/repo`.
5. Deploy Worker từ thư mục chứa `worker.js` và `wrangler.toml`:
   ```bash
   npx wrangler deploy
   ```
6. Sao chép URL Worker được in ra, mở `koax-config.js` và đặt:
   ```js
   window.KOAX_CONFIG = { API_BASE: "https://koax-gate-api.TEN-SUBDOMAIN.workers.dev" };
   ```
   Không thêm dấu `/` ở cuối.
7. Upload toàn bộ file website (bao gồm `gate.html`, `access-denied.html`, `koax-config.js`) lên repository GitHub Pages và kiểm tra qua HTTPS.

## Các file quan trọng
- `koax_script_premium.html`: trang chính; các nút Get Script đi qua link trung gian.
- `gate.html`: sinh URL ngẫu nhiên và đăng ký mã trình duyệt.
- `script.html`: trang đích, kiểm tra flow trước khi hiển thị nội dung.
- `access-denied.html`: trang thông báo cần vượt link trước.
- `worker.js` + `wrangler.toml`: xác minh server-side qua Cloudflare KV.

## Giới hạn cần biết
Cơ chế này kiểm soát việc hiện trang trên website, không thể bảo vệ một file JavaScript nếu URL raw của file đó vẫn public trên GitHub. Nếu cần giữ kín source thực sự, hãy dùng repository private và để Worker kiểm tra quyền rồi mới trả nội dung script; đừng đặt link raw public trong HTML.
