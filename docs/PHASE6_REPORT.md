> Báo cáo lịch sử Phase 6. Thay đổi tháng 9/2026 và giới hạn xác minh hiện tại nằm trong [UPGRADE_2026_09.md](UPGRADE_2026_09.md).

# Báo cáo Phase 6

## Trạng thái

Hoàn tất triển khai và kiểm tra mã nguồn ở môi trường cục bộ. **Chưa nghiệm thu vận hành trên Supabase thật** vì chưa có dự án/khóa kết nối trong phiên làm việc. Không đưa dữ liệu mẫu vào ứng dụng và không dùng kết quả test cục bộ để giả lập hệ thống đang hoạt động.

## Kết quả đã xác nhận

| Hạng mục                   | Kết quả                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `npm install`              | Thành công                                                                            |
| `npm run build`            | Thành công với Next.js 16.3.4                                                         |
| `npm run typecheck`        | Thành công, không có lỗi TypeScript                                                   |
| `npm test`                 | 18/18 kiểm tra thành công                                                             |
| Migration PostgreSQL       | Cả 6 migration chạy trong môi trường kiểm thử PGlite                                  |
| RLS                        | Kiểm tra quyền đúng/sai lớp, tài khoản khóa, phiên chưa bind, reset thiết bị          |
| Chấm điểm                  | Numeric, biên dung sai, CHALLENGE, EXAM, kiểm tra đơn vị, ngân sách tự luận           |
| Lịch sử                    | Không ghi đè đáp án cũ, retry idempotent, giới hạn lượt nộp                           |
| Tệp                        | Chữ ký định dạng, loại/dung lượng, quyền đề trước khi bắt đầu, UUID file ngoại lai    |
| Danh sách lớn              | Kiểm tra 1.260 lượt nộp không bị cắt ở mốc 1.000 hàng                                 |
| Đóng gói Workers           | OpenNext + Wrangler dry-run thành công; chưa thay thế nghiệm thu dịch vụ thật         |
| Dependencies chạy ứng dụng | `npm audit` và `npm audit --omit=dev`: không phát hiện lỗ hổng tại thời điểm kiểm tra |

Dữ liệu Auth/Storage trong bài test được thiết lập riêng để kiểm tra SQL/RLS. Đây không phải kiểm thử dịch vụ Supabase Auth/Storage qua mạng, không đo đồng thời nhiều PostgreSQL connection, và không phải kiểm thử trình duyệt.

## Những lỗi/rủi ro đã sửa trong Phase 6

1. Tên biến và bí danh SQL trùng nhau trong thao tác giao đề.
2. Policy Storage tham chiếu cột `name` chưa tường minh, gây từ chối file hợp lệ.
3. Ngăn đọc đề trước khi bắt đầu phiên có tính giờ.
4. Ngăn giáo viên tự ghi danh học sinh của lớp khác để lấy quyền reset tài khoản.
5. Sửa đồng bộ timer để polling không đặt lại bộ đếm theo mốc ban đầu; khởi tạo ngay từ giờ server để tránh lóe trạng thái hết giờ khi vào phòng thi.
6. Giữ phiên bản autosave khi đáp ứng server đến trong lúc học sinh đang gõ.
7. Xử lý giờ nhập theo múi giờ thực của browser, không cộng cố định UTC+7 khi sửa lịch.
8. Giới hạn body JSON cả khi thiếu Content-Length; kiểm tra Content-Type thực và chữ ký file.
9. Chặn bấm nộp khi tệp đang upload; hiển thị đủ tệp của từng lần nộp theo thứ tự.
10. Phân trang truy vấn để không bỏ sót lịch sử vượt 1.000 hàng.
11. Sửa thông báo bù trừ khi tạo tài khoản thành công nhưng thêm vào lớp thất bại.
12. Cập nhật dependency UUID dùng bởi ExcelJS; bảo vệ CSV xuất khỏi tiền tố công thức.

## Chức năng đã triển khai

- Đăng nhập bằng username/password, ba vai trò, xác thực server + RLS.
- Admin tạo/khóa/mở giáo viên, tạo/đổi tên lớp, phân công lại lớp, reset mật khẩu/thiết bị.
- Giáo viên quản lý học sinh, nhập CSV/XLSX, cấp mật khẩu ban đầu và tải thông tin vừa tạo.
- Tạo kỳ thi, upload PDF, thêm/sửa/xóa Problem khi còn nháp; khóa đề sau giao.
- Numeric/text/essay/file_only, dung sai tuyệt đối/tương đối, PRACTICE/CHALLENGE/EXAM.
- Phòng thi PDF/Problems, timer server, autosave/offline và giải quyết xung đột bản nháp.
- Nộp nhiều PDF/ảnh, preview, đổi thứ tự, kiểm tra tệp; lưu mọi attempt.
- Dashboard tiến độ và chấm từng lượt, nhận xét, điểm tự động + tự luận.
- Clarification riêng, announcement cho cả lớp, polling 10 giây.
- Công bố/ẩn kết quả và xem lịch sử cá nhân; đáp án chuẩn chỉ xuất hiện đúng thời điểm.
- CSS responsive cho desktop/tablet/mobile; KaTeX cho công thức trong tiêu đề/đáp án tham khảo.
- README, script tạo Admin đầu tiên, script backup tệp và kịch bản nghiệm thu.

## Chưa thực hiện / việc cần làm trước production

- **TODO — Cấu hình dịch vụ thật:** điền ba biến Supabase và APP_URL, chạy migration trên một dự án riêng.
- **TODO — Nghiệm thu tích hợp:** Auth thật, signed upload/download thật, tạo tài khoản thật, quy trình thi/chấm/công bố qua trình duyệt.
- **TODO — Nghiệm thu giao diện:** kiểm tra trực quan và bàn phím trên desktop/tablet/mobile, mức phóng chữ 200% theo `ACCEPTANCE.md`.
- **TODO — Vận hành:** kiểm thử tải và phục hồi backup trên hạ tầng sẽ sử dụng.
- Chưa triển khai ghép ảnh thành PDF (chức năng tùy chọn trong yêu cầu).
- Chưa có dọn tệp mồ côi tự động; không xóa các tệp đang được attempt tham chiếu.
- Thông báo dùng polling, chưa dùng WebSocket/Supabase Realtime.

Không dùng câu “hoàn tất nghiệm thu production” cho bản bàn giao này khi các mục TODO tích hợp còn chưa được xác nhận.

## Tài liệu liên quan

- `README.md`: cài đặt, biến môi trường, migration, bucket, Admin, deploy, backup.
- `SECURITY.md`: ma trận quyền, RLS, thiết bị và giới hạn của signed URL.
- `ACCEPTANCE.md`: kịch bản chạy trên Supabase/trình duyệt thật.

## Ghi chú hosting Workers

OpenNext 1.20.6 cảnh báo hỗ trợ Node.js middleware/proxy trên Cloudflare còn experimental. Bản Next.js 16 với `proxy.ts` được giữ nguyên; đóng gói thành công không phải xác nhận mọi luồng Auth trên Workers đã được kiểm thử. Nên ưu tiên môi trường Node.js hỗ trợ Next.js khi nghiệm thu cho kỳ thi chính thức.
