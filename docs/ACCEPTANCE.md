# Nghiệm thu trước kỳ thi đầu tiên

Các mục dưới đây là kịch bản cần chạy với Supabase thật. Chúng chưa được đánh dấu là đã chạy trong lần bàn giao này.

## Chuẩn bị

Dùng dự án thử nghiệm riêng. Tạo một Admin, hai giáo viên A/B, hai lớp tương ứng, và học sinh S1/S2 ở hai lớp. Dùng PDF thử không chứa dữ liệu học sinh. Không dùng tài khoản hoặc bài thi chính thức để thử các thao tác khóa/reset.

## Luồng chính

1. Admin tạo giáo viên, tạo lớp và phân công. Giáo viên chỉ thấy lớp của mình, không có nút tạo lớp.
2. Giáo viên thêm một học sinh. Thử CSV đúng, XLSX đúng, username trùng, dòng thiếu tên, mật khẩu quá ngắn, danh sách trên 100 dòng.
3. Tạo kỳ thi PRACTICE. Upload PDF và tạo bốn bài numeric/text/essay/file_only. Giao đề khi thiếu PDF/Problem phải bị từ chối.
4. S1 mở kỳ thi trước giờ: chưa được xem đề. Đến giờ, bấm bắt đầu; deadline xuất hiện từ server.
5. Thử numeric 3.5, 3,5, 3.5e-4, 3.5E-4; cấu hình đáp án/dung sai phù hợp từng thử nghiệm. Thử biên trong/ngoài dung sai và sai đơn vị.
6. Upload PDF, nhiều ảnh; xem preview; kéo thứ tự và dùng nút lên/xuống; nộp. Giáo viên phải thấy đủ file theo đúng thứ tự của từng lượt.
7. Giáo viên chấm điểm và nhận xét. Thử vượt điểm tối đa; phải bị từ chối. Trước công bố, S1 chưa thấy điểm. Sau đóng kỳ thi và công bố, S1 xem được điểm/đáp án của mình.
8. Gửi clarification. Kiểm tra trả lời riêng không xuất hiện với người khác; câu trả lời công bố trở thành announcement.

## Thiết bị và quyền

- S1 đăng nhập browser A; browser B phải bị từ chối.
- Teacher reset S1: browser A không đọc/ghi thêm bằng phiên cũ; lần đăng nhập kế tiếp chọn thiết bị mới.
- Khóa học sinh/giáo viên: xác minh API đọc/ghi bị chặn, không chỉ button bị ẩn.
- Giáo viên A thử URL và UUID lớp/kỳ thi của B. Phải bị từ chối.
- S1 thử UUID file và kỳ thi của S2. Phải bị từ chối.
- Chuyển lớp từ A sang B; A mất quyền với các kỳ thi của lớp ngay ở backend/RLS.
- Gọi Supabase REST bằng JWT Auth chưa qua bước bind device: không được đọc dữ liệu riêng.

## Mạng và thời gian

- Ngắt mạng khi đang nhập; đóng/mở lại trang khi mạng trở lại; bản nháp vẫn được giữ nếu chưa xóa dữ liệu trình duyệt.
- Mở hai tab và sửa cùng Problem; xác minh thông báo xung đột và hai lựa chọn giữ bản.
- Ngắt mạng ngay sau bấm nộp rồi gửi lại; database chỉ có một lượt cho cùng request_id.
- Đổi đồng hồ máy học sinh; deadline server không đổi.
- Thử hết giờ với allow_late_submission tắt/bật. Khi bật, lần nộp sau deadline có is_late.
- Bấm kết thúc bài; mọi lần nộp mới bị từ chối.
- EXAM chỉ nhận một lần/Problem và không trả đúng/sai trước công bố.

## Responsive và trình duyệt

Kiểm tra trực tiếp trên laptop khoảng 1440 px, tablet khoảng 768 px, điện thoại khoảng 390 px, mức phóng chữ 200% và thao tác bàn phím. Desktop có PDF/bài trả lời song song; màn hình nhỏ chuyển tab PDF/Problems. Xác minh PDF mở trong viewer hoặc bằng “Mở rộng”, không bị kẹt ở màn hình trắng. Kiểm tra thứ tự ảnh, tab focus, nhãn form, thông báo lỗi và các nút không bị cắt.

## Vận hành

Kiểm tra backup database và Storage riêng, phục hồi thử sang dự án khác, xác nhận quyền riêng tư bucket và các giới hạn dung lượng. Đo tải theo số học sinh dự kiến trên chính hosting/Supabase sẽ sử dụng; polling thông báo hiện là 10 giây. Không suy ra khả năng chịu tải từ việc build thành công.
