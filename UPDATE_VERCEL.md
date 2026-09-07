# Cập nhật trên Vercel

Bản này giữ các thay đổi chức năng của gói cập nhật tháng 9/2026 nhưng đã giữ workaround Vercel đang dùng:

- `npm run build` dùng `next build --webpack`.
- Không dùng `output: 'standalone'` trong `next.config.ts`.

Với hệ thống đã chạy 001-006, chỉ chạy migration 007_session_lifecycle.sql rồi 008_upload_and_publish.sql. Không chạy lại 001-006.

Giữ nguyên `.env.local`, `.git`, `.vercel` của project hiện tại. Sau khi chép mã nguồn, chạy `npm ci`, `npm run build`, rồi commit/push GitHub để Vercel tự deploy.
