# Thiết kế bảo mật

## Ranh giới tin cậy

Danh tính lấy từ Supabase Auth trên server. Vai trò lấy từ `profiles`, không nhận từ form hay `user_metadata`. Khóa quản trị chỉ nằm trong `lib/supabase/admin.ts` với `server-only` và các script chạy ngoài website. Browser không lưu access/refresh token trong localStorage; cookies Auth được đặt HttpOnly, SameSite=Lax, Secure khi chạy production.

Mỗi API thay đổi dữ liệu kiểm tra Origin bằng `APP_URL`, xác thực, thiết bị và Zod. Yêu cầu JSON bị giới hạn 1 MB kể cả khi không có Content-Length. Backend không ghi mật khẩu hoặc token vào log ứng dụng.

## Ma trận quyền đọc

| Dữ liệu                        | Admin                          | Teacher                                  | Student                                                      |
| ------------------------------ | ------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| Profiles                       | Tất cả                         | Chính mình, học sinh thuộc lớp phụ trách | Chính mình                                                   |
| Classes                        | Tất cả                         | Lớp được giao                            | Lớp có tên trong danh sách                                   |
| Class students                 | Tất cả                         | Thành viên lớp phụ trách                 | Chỉ membership của mình                                      |
| Exams                          | Tất cả                         | Kỳ thi thuộc lớp phụ trách               | Kỳ thi đã giao trong lớp mình                                |
| Problems                       | Tất cả                         | Kỳ thi được quản lý                      | Sau mở đề và bắt đầu phiên; hoặc khi công bố kết quả         |
| Problem keys                   | Tất cả                         | Kỳ thi được quản lý                      | Không raw SELECT; RPC kết quả chỉ trả sau kết thúc + công bố |
| Submissions / attempts         | Tất cả                         | Kỳ thi được quản lý                      | RPC chỉ trả lịch sử cá nhân, lọc điểm chưa công bố           |
| Answer drafts                  | Không đọc nháp học sinh qua UI | Không đọc nháp học sinh                  | Của mình                                                     |
| Exam sessions                  | Tất cả                         | Kỳ thi được quản lý                      | Của mình                                                     |
| Devices                        | Tất cả                         | Chính mình và học sinh được quản lý      | Chính mình                                                   |
| Clarifications                 | Tất cả                         | Kỳ thi được quản lý                      | Câu hỏi của mình                                             |
| Announcements                  | Tất cả                         | Kỳ thi được quản lý                      | Kỳ thi được giao                                             |
| File assets / submission files | Theo quyền quản lý kỳ thi      | Theo quyền quản lý kỳ thi                | File của mình; đề đúng thời gian; đáp án sau công bố         |
| Audit logs                     | Tất cả                         | Không raw SELECT                         | Không raw SELECT                                             |
| Private tables                 | Chỉ qua các RPC phù hợp        | Chỉ qua các RPC phù hợp                  | Không raw SELECT                                             |

## Quyền ghi

Không cấp quyền INSERT/UPDATE/DELETE bảng nghiệp vụ cho `authenticated`. Chức năng ghi đi qua các hàm SECURITY DEFINER có search_path cố định, kiểm tra danh tính và phạm vi lớp/kỳ thi trước khi thực hiện.

- `manage`: chỉ Admin tạo/sửa/giao lớp. Teacher quản lý kỳ thi của lớp được giao và học sinh trong phạm vi đó.
- Giáo viên chỉ được đưa học sinh mới do chính mình cấp (chưa ở lớp nào), hoặc học sinh đã thuộc phạm vi quản lý của mình, vào lớp. Không tự lấy học sinh lớp khác bằng UUID.
- `start_exam`, `submit_answer`, `save_draft`, `finish_exam`, `ask_clarification`: chỉ học sinh hợp lệ trong kỳ thi đó.
- `bind_device`, `check_login_rate`, `complete_file`: chỉ service_role, không cho browser gọi bằng khóa publishable.
- Sau khi giao đề, cấu hình kỳ thi, Problem, đáp án và dung sai bị khóa.
- Điểm tự luận giới hạn trong phần điểm dành cho tự luận. Giáo viên không được đặt trực tiếp auto_score hoặc final_score.

## Thiết bị

Trình duyệt tạo UUID ngẫu nhiên trong lần đăng nhập đầu. Server giữ token trong cookie HttpOnly và chỉ lưu SHA-256 ở `user_devices.device_id`. Mỗi user có tối đa một dòng active nhờ partial unique index.

JWT có chữ ký đúng nhưng chưa được server xác nhận thiết bị vẫn không có dữ liệu qua RLS: `current_role()` kiểm tra `private.device_sessions` theo `auth.jwt().session_id`. Backend còn so hash cookie để hạn chế việc mang riêng cookie Auth sang browser khác.

Reset thiết bị xóa các liên kết session và vô hiệu hóa thiết bị cũ. Khóa tài khoản cũng thu hồi liên kết. Lần đăng nhập sau reset đăng ký thiết bị mới. Đây là liên kết với trình duyệt, không phải nhận dạng phần cứng. Xóa cookies, dùng browser khác hoặc ẩn danh có thể cần giáo viên reset. Người chủ động sao chép đầy đủ thông tin phiên/thiết bị vẫn có thể vượt mô hình này; hệ thống không được mô tả như công cụ chống gian lận tuyệt đối.

## Tệp

Ba bucket private. Signed upload được cấp sau kiểm tra quyền và metadata, không dùng upsert. API xác nhận kiểm tra kích thước thực, Content-Type và chữ ký đầu file; không chỉ tin phần mở rộng. Học sinh không thể đính kèm UUID tệp của người khác hoặc tệp thuộc Problem khác.

Mỗi lần nộp lưu liên kết tệp và thứ tự bất biến. Bỏ file khỏi danh sách chuẩn bị nộp chỉ bỏ lựa chọn, không xóa các file đã thuộc lịch sử. Tệp đã tải nhưng chưa được gắn vào lần nộp, hoặc phiên bản đề cũ, có thể vẫn chiếm dung lượng; cần quy trình dọn tệp có kiểm tra tham chiếu khi vận hành lâu dài. Chưa tự động xóa những tệp này.

Signed URL đọc có hạn 120 giây. URL đã cấp là bearer capability và còn hiệu lực đến khi hết hạn; reset thiết bị không thu hồi tức thời URL đã phát. PDF đã được tải về không thể bị thu hồi từ thiết bị. Kiểm tra chữ ký file không phải quét virus.

## Nghiệp vụ thi

- Đồng hồ hệ điều hành học sinh không quyết định hạn nộp.
- PostgreSQL kiểm tra deadline và trạng thái kỳ thi khi nhận bài.
- Advisory lock, unique constraint và request UUID chống nộp đúp/vượt lượt.
- Học sinh chỉ nhận điểm khi kết quả được công bố; EXAM không trả đúng/sai sớm.
- Không truyền correct_answer qua cấu hình Client Component trước công bố.
- Mỗi lần nộp có một hàng mới; chấm lại chỉ sửa điểm/nhận xét của hàng đó, giữ đáp án và thời điểm nộp.
- CSV xuất cho thông tin tài khoản có xử lý tiền tố công thức bảng tính.

## Phạm vi xác nhận

RLS, các RPC quan trọng và các nhánh lỗi đã được kiểm thử với PostgreSQL/PGlite. Phần giả lập trong test chỉ thay schema Auth/Storage nền tảng để chạy SQL trong môi trường kiểm thử; ứng dụng thật không dùng PGlite và không có dữ liệu mô phỏng.

Chưa xác nhận Supabase Auth/Storage thật, vận hành trên nhiều trình duyệt, hoặc khả năng chịu tải của gói dịch vụ. Không có cam kết về số học sinh đồng thời khi chưa đo trên cấu hình production.
