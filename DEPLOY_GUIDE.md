# Hướng Dẫn Deploy Chat Togetther (Render + Vercel)

Dự án đã được cấu hình hoàn chỉnh để triển khai dễ dàng:
- **Backend (Spring Boot 3 + Java 21):** Triển khai lên **Render** (hỗ trợ Docker, WebSocket WSS, SSL miễn phí).
- **Frontend (React + Vite):** Triển khai lên **Vercel** (CDN toàn cầu, tốc độ cao, hỗ trợ SPA routing).

---

## Phần 1: Deploy Backend lên Render

1. Đăng ký / Đăng nhập tài khoản tại [https://render.com](https://render.com).
2. Push toàn bộ source code của bạn lên GitHub.
3. Trên Render Dashboard:
   - Bấm **New +** -> Chọn **Web Service**.
   - Kết nối với GitHub Repository của dự án `ChatTogetther`.
4. Điền các thông tin cấu hình:
   - **Name:** `chattogetther-backend` (hoặc tên tùy bạn).
   - **Region:** Singapore (`Southeast Asia`) để có độ trễ thấp nhất cho người dùng Việt Nam.
   - **Root Directory:** `chattogettherBackend/Backend`
   - **Runtime / Environment:** Chọn **Docker**.
   - **Instance Type:** Chọn gói **Free**.
5. Cấu hình biến môi trường (**Environment Variables**):
   - Mặc định, `application.properties` đã chứa sẵn chuỗi kết nối Neon PostgreSQL. Nếu bạn muốn đổi DB khác hoặc bảo mật, có thể thêm các key:
     + `SPRING_DATASOURCE_URL`: URL PostgreSQL của bạn
     + `SPRING_DATASOURCE_USERNAME`: username DB
     + `SPRING_DATASOURCE_PASSWORD`: password DB
6. Bấm **Create Web Service**.
   - Render sẽ tự động kéo Dockerfile Java 21, build Maven và khởi chạy service.
   - Khi hoàn tất, bạn sẽ nhận được URL Backend, ví dụ:
     `https://chattogetther-backend.onrender.com`

---

## Phần 2: Deploy Frontend lên Vercel

1. Đăng nhập tại [https://vercel.com](https://vercel.com).
2. Bấm **Add New...** -> Chọn **Project**.
3. Chọn Repository `ChatTogetther` từ GitHub.
4. Cấu hình dự án trên Vercel:
   - **Framework Preset:** `Vite` (Vercel thường tự nhận diện).
   - **Root Directory:** Bấm **Edit** -> Chọn thư mục `chattogettherFrontend`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Thêm biến môi trường (**Environment Variables**):
   - **Key:** `VITE_API_URL`
   - **Value:** Điền link Backend trên Render ở Phần 1 (Lưu ý: **không** có dấu `/` ở cuối).
     *Ví dụ:* `https://chattogetther-backend.onrender.com`
6. Bấm **Deploy**.
   - Vercel sẽ tự động build và cấp domain miễn phí (ví dụ: `https://chattogetther.vercel.app`).
   - File `vercel.json` đã được tạo sẵn trong project để chống lỗi 404 khi người dùng tải lại trang trong phòng chat `/room/:id`.

---

## Phần 3: Chạy toàn bộ hệ thống bằng Docker tại máy cục bộ (Local)

Nếu bạn muốn chạy thử cả Frontend và Backend bằng Docker trên máy tính:

```bash
# Đứng tại thư mục gốc ChatTogetther
docker compose up --build
```

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:8080`

