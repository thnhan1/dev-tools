# URL Redirect Pro — User Guide

Extension hỗ trợ điều hướng URL, tự động chuyển đổi đường dẫn AEM Author và sửa lỗi đường dẫn trên `http://localhost:4502`.

---

## 📥 1. Hướng Dẫn Cài Đặt (Installation)

1. Mở trình duyệt (Chrome / Edge / Firefox) và truy cập trang quản lý Extension:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
2. Bật **Developer mode** (với Chrome/Edge).
3. Cài extension:
   - Chrome/Edge: bấm **Load unpacked** và chọn thư mục `redirect-ext`.
   - Firefox (khuyến nghị bản 113+): bấm **Load Temporary Add-on...** và chọn file `/home/runner/work/dev-tools/dev-tools/redirect-ext/manifest.json`.

---

## 🚀 2. Các Tính Năng & Hướng Dẫn Sử Dụng

### ✏️ 2.1 Bật / Tắt Chế Độ AEM Editor (`Edit Mode`)
- Click vào biểu tượng Extension trên thanh công cụ.
- Bấm nút **`✏️ Edit Mode`** ở góc trên cùng:
  - Nếu đang ở trang preview: `http://localhost:4502/content/mysite/us/en.html` → Trang sẽ chuyển sang chế độ Edit: `http://localhost:4502/editor.html/content/mysite/us/en.html`.
  - Bấm lại lần nữa để quay lại chế độ Preview.

### ⚡ 2.2 Tự Động Rewrite URL Live Site Sang Localhost
- **Tự động bóc tách URL**: Khi bạn dán đường dẫn trang Live (ví dụ: `https://live-site.com/abc`) hoặc đường dẫn lồng nhau vào `localhost:4502`, Extension sẽ tự động điều hướng về: `http://localhost:4502/content/mysite/abc`.
- **Kiểm tra lỗi 404**: Extension sẽ kiểm tra ngầm trang đích. Nếu đường dẫn thiếu `.html` dẫn đến 404, Extension sẽ tự động bổ sung `.html` trước khi chuyển trang.

### 🔍 2.3 Tự Động Khắc Phục Đường Dẫn Ngắn (Auto-Resolver)
- Khi gõ các đường dẫn ngắn bị thiếu prefix hoặc thiếu đuôi `.html` trên `localhost:4502`, Extension sẽ tự động thử các ứng viên đường dẫn khả thi (ví dụ thêm prefix `/content/mysite` hoặc thêm `.html`) để load đúng trang.

### 📋 2.4 Cấu Hình Quy Tắc Tùy Chỉnh (Rules)
- Trong tab **📋 Rules**: Bạn có thể thêm các quy tắc chuyển hướng tùy chỉnh:
  - `Match Type`: Prefix, Regex, hoặc Exact.
  - `From Pattern`: Đường dẫn nguồn (ví dụ: `https://localhost:4502/`).
  - `To Pattern`: Đường dẫn đích (ví dụ: `http://localhost:4502/`).

---

## ⚙️ 3. Cấu Hình Tùy Chỉnh (Config Options)

Bạn có thể chỉnh sửa trực tiếp trên giao diện hoặc qua tab **⚙️ JSON**:

| Trường Cấu Hình | Mô Tả | Ví Dụ |
| :--- | :--- | :--- |
| `defaultSiteName` | Tên site mặc định của dự án AEM | `"mysite"` |
| `liveDomains` | Danh sách tên miền Live Site cần rewrite | `["https://live-site.com"]` |
| `pathPrefixes` | Danh sách Prefix tự động thêm khi gõ url ngắn | `["/content/mysite"]` |

*Sau khi thay đổi cấu hình, nhớ bấm **💾 Save** để áp dụng.*
