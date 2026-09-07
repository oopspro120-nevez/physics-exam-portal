# Physics Exam Portal – Bản cập nhật tháng 9/2026

[chưa xác minh] Các phần về vận hành thực tế và cấu hình đề xuất chưa được thử trên website đang sử dụng.

Bản cập nhật xử lý vòng đời đăng nhập, tải PDF–giao đề và tải dữ liệu. Đây là thay đổi mã nguồn; website đang chạy chỉ nhận thay đổi sau khi cập nhật database và triển khai mã nguồn mới.

## 1. Thay đổi đã thực hiện

### Đăng nhập và thiết bị

- Máy chủ và chính sách dữ liệu RLS từ chối phiên sau 30 phút không có thao tác. Việc tự tải thông báo, kiểm tra phiên hoặc tự gia hạn JWT không được tính là thao tác của người dùng.
- Hiển thị cảnh báo trước khi hết hạn một phút. Chọn **Tiếp tục làm việc** để xác nhận còn hoạt động. Đọc PDF hoặc giải bài trên giấy có thể không phát sinh thao tác; học sinh cần chú ý cảnh báo.
- Dùng thời gian trôi qua thực tế để phát hiện máy ngủ hoặc treo. Khi quay lại sau thời hạn, phiên cũ không được khôi phục bằng heartbeat.
- Khi nhận được tín hiệu đóng tab cuối, phiên có khoảng chờ 60 giây để tải lại trang hoặc chuyển trang. Hết khoảng này, phiên bị từ chối và lần đăng nhập mới giải phóng ràng buộc thiết bị cũ.
- Một tab đóng không chấm dứt những tab khác vẫn còn mở. Đăng xuất chủ động thu hồi các phiên gắn với thiết bị và cho phép chuyển thiết bị ngay.
- Cookie xác thực trở thành cookie phiên. Cookie nhận diện thiết bị không phải quyền đăng nhập.
- Bản nháp câu trả lời đã lưu vẫn được giữ. Đăng xuất không đồng nghĩa với nộp bài và không kéo dài hạn nộp của kỳ thi.

**Giới hạn cần hiểu đúng:** trình duyệt không đảm bảo phát tín hiệu khi mất điện, bị đóng cưỡng bức hoặc mất mạng. Vì vậy không thể cam kết “đóng web là server biết ngay” trên mọi thiết bị. Khi không nhận được tín hiệu đóng, cơ chế dự phòng là hết hạn 30 phút từ thao tác cuối. Trình duyệt khôi phục phiên có thể khôi phục cookie; RLS vẫn kiểm tra thời hạn độc lập. Link tải riêng đã được cấp trước khi đăng xuất vẫn có thể dùng đến hết thời hạn 120 giây của link.

### Tải PDF và giao đề

- Nhận PDF hợp lệ khi trình duyệt không cung cấp MIME type; kiểm tra chữ ký tệp ở trình duyệt và xác minh lại trên máy chủ.
- Tải trực tiếp lên Supabase Storage qua giao thức TUS, chia khối 6 MiB, có tiến độ và tự thử lại khi mạng gián đoạn. Token tải lên chỉ giữ trong bộ nhớ trang, không lưu xuống ổ đĩa trình duyệt.
- Nút **Thử lại** ở khu vực tải tệp tiếp tục công việc trên cùng trang. Nếu upload đã thành công, chỉ thử lại khâu xác minh. Không cam kết tiếp tục sau khi đóng/tải lại trang.
- Mỗi yêu cầu tạo kỳ thi và đăng ký file có mã riêng để thử lại không tạo trùng. Xác minh lại một file cũ không thay thế PDF mới hơn.
- Giao đề kiểm tra lại quyền, PDF hiện tại đã xác minh, câu hỏi, đáp án và hạn cuối ở database. Lặp lại thao tác giao đề đã thành công trả về kết quả cũ.
- Giao diện có thông tin kỳ thi, PDF, câu hỏi–thang điểm và danh sách kiểm tra trước khi giao. Giờ nhập và giờ hiển thị thống nhất theo Việt Nam (UTC+7).
- Câu tự luận tự đặt phần điểm tự động bằng 0; các trường dung sai chỉ xuất hiện khi chọn đáp số. Không cần nhập lại nội dung đã có trong PDF.
- Chặn giao đề khi form còn thay đổi chưa lưu hoặc đang tải tệp.

### Tốc độ

- Gộp kiểm tra profile, phiên và thiết bị thành một RPC; dùng cache của React **trong một lượt render**, không dùng cache chung giữa người dùng.
- Dùng `getClaims()` để kiểm tra JWT; vẫn kiểm tra quyền, khóa tài khoản và hết hạn tại database. Dự án dùng khóa ký đối xứng cũ có thể vẫn cần xác minh qua Auth server.
- API không đi qua một lần kiểm tra Auth lặp ở Proxy; route tự xử lý cookie và xác thực.
- Trang tạo kỳ thi chỉ lấy danh sách lớp. Trang soạn đề không tải toàn bộ bài nộp, phiên thi, giải đáp và tệp của học sinh.
- Trang chấm bài/giải đáp lấy danh sách học sinh đúng lớp; đáp án được truy vấn bằng phép nối, tránh URL chứa danh sách dài UUID.
- Học sinh cập nhật dữ liệu mỗi 20 giây khi trang đang hiển thị, tránh yêu cầu chồng nhau và bỏ qua lượt tải nền khi ẩn. Giáo viên cập nhật trang chấm/giải đáp mỗi 30 giây khi không nhập liệu.
- Thư viện upload tải khi cần. Giảm prefetch trên danh sách kỳ thi và các ô chấm điểm, thêm trạng thái chờ khi chuyển trang.

Các thay đổi này giảm yêu cầu dư; chưa có số đo thời gian tải trang, p95 hoặc thử tải trên website thực tế. Không diễn giải số lượng kiểm thử đạt thành bảo đảm chịu tải.

## 2. Cách cập nhật hệ thống đang có dữ liệu

1. Chọn thời điểm không diễn ra kỳ thi; sao lưu database và các tệp theo README.
2. Giữ nguyên dự án Supabase, tài khoản, dữ liệu và các biến môi trường hiện đang dùng.
3. Trong **Supabase → SQL Editor**, chạy toàn bộ `supabase/migrations/007_session_lifecycle.sql` một lần. Khi thành công, chạy tiếp `008_upload_and_publish.sql` một lần. Nếu dùng Supabase CLI quản lý lịch sử, tiếp tục dùng CLI cho cả hai file; không trộn hai cách.
4. **Không chạy lại 001–006** trên hệ thống đã khởi tạo. Không sửa và chạy lại những migration đã áp dụng. Nếu một migration báo lỗi, dừng và lưu nguyên thông báo lỗi.
5. Thay mã nguồn, dùng `npm ci`, rồi `npm run build`. Dùng bản production (`npm start` hoặc quy trình triển khai của hosting), không dùng `npm run dev` để đánh giá tốc độ vận hành.
6. Với ChatGPT Sites, bước đóng gói Worker là `npm run build:worker` sau khi build Next.js thành công. Hai quy trình không chạy cùng lúc. Supabase migrations không tự được Sites chạy thay.
7. Kiểm tra biến `APP_URL` khớp chính xác origin của website. Hai biến `NEXT_PUBLIC_SUPABASE_*` phải có lúc build; khóa bí mật chỉ ở phía server. Không đổi tên miền để sửa lỗi quyền một cách tùy tiện.
8. Đăng xuất/đăng nhập lại, kiểm tra quy trình giáo viên–học sinh bằng tài khoản thử trước kỳ thi chính thức.

Nếu database đã có tên hàm/cột trùng do một bản nâng cấp khác, cần đối chiếu lịch sử trước khi chạy 007–008. Hai migration đều dùng transaction; không được bỏ qua lỗi và triển khai mã nguồn khi migration chưa thành công.

## 3. Quy trình giáo viên sau cập nhật

1. **Kỳ thi → Tạo kỳ thi**: điền tên, lớp, thời lượng và giờ mở–hạn cuối. Có thể chọn PDF ngay tại đây.
2. Bấm **Lưu và tiếp tục đến câu hỏi**. Nếu mạng gián đoạn, giữ trang và thử lại; thông tin đã lưu không bị tạo trùng.
3. Thêm các câu theo thứ tự trong PDF; chọn tự luận/tệp lời giải/đáp số/văn bản ngắn, đặt điểm và lưu từng câu.
4. Kiểm tra cột bên phải: đúng lớp, PDF đã sẵn sàng, đủ câu, đủ đáp án, lịch còn hiệu lực. Mở PDF để đối chiếu tệp đã chọn.
5. Bấm **Giao đề cho lớp**, đọc tên lớp, số câu, tổng điểm và giờ mở trong xác nhận. Sau khi giao, cấu trúc đề và đáp án chấm bị khóa.

## 4. Phương án cho khoảng 20 người cùng sử dụng

Đây là đề xuất cấu hình ban đầu, cần đo trên hệ thống thật:

| Phương án | Khi phù hợp | Việc cần làm |
| --- | --- | --- |
| Giữ Next.js + Supabase và hosting hiện tại | Hosting hiện tại chạy ổn định, thuận tiện cho giáo viên | Áp dụng bản sửa, dùng production build, theo dõi lỗi/độ trễ và kích thước PDF trước khi nâng cấp hạ tầng. |
| Hosting Node.js được quản lý, ở khu vực gần Supabase | Độ trễ giữa ứng dụng và database hoặc khởi động nguội là nút thắt đã đo được | Chọn khu vực phù hợp với database; cấu hình đầy đủ biến build/runtime; dùng một ứng dụng, chưa cần thêm Redis hoặc hệ thống hàng đợi. |
| Máy chủ riêng/VPS | Có người phụ trách vận hành, cần giữ tiến trình chạy liên tục | Cấu hình ban đầu có thể thử 2 vCPU/2 GB RAM, SSL, giám sát tiến trình và backup; điều chỉnh theo số đo, không coi thông số này là cam kết năng lực. |

Ưu tiên phương án đầu tiên trước khi phát sinh chi phí hoặc chuyển hệ thống. Số người đăng nhập không tự thể hiện tải: 20 người mở trang thông thường khác 20 người tải ảnh/PDF đồng thời. Giữ file trên Storage, khuyến khích PDF được tối ưu kích thước nhưng phải giữ công thức và hình rõ. Nếu còn chậm, đo riêng độ trễ trang/API, thời gian tải tệp, kích thước phản hồi và lỗi database để xác định điểm nghẽn.

## 5. Kiểm chứng và giới hạn bàn giao

Đã chạy bộ kiểm thử PostgreSQL/PGlite, quyền RLS, chấm điểm, phân trang, vòng đời phiên, MIME và các thao tác thử lại. Kết quả hiện tại: **24 kiểm thử đạt**. Build Next.js production và đóng gói Worker/OpenNext đều đã thành công. OpenNext cảnh báo hỗ trợ Node.js Proxy trên Cloudflare còn thử nghiệm; triển khai Node.js thông thường là phương án có thể đánh giá nếu gặp lỗi tương thích ở lớp này. Đã kiểm tra chữ ký đầu tệp của 16 PDF đính kèm, tệp lớn nhất khoảng 18,25 MiB; đây không phải kiểm thử upload qua Supabase thật.

Chưa kiểm chứng: Auth/Storage trên Supabase của cô, upload TUS qua mạng thật, giao diện bằng trình duyệt, đo tải 20 tài khoản thật, tình huống ngủ máy/đóng cưỡng bức trên từng trình duyệt. Bản Sites tìm được khi làm việc chưa có biến môi trường kết nối Supabase; do đó không coi Site đó là bản đang vận hành thực tế của cô nếu chưa đối chiếu URL.

Nghiệm thu cần thực hiện trên môi trường thử: mở hai tab–đóng một tab; đóng tab cuối rồi quay lại sau 60 giây; để yên 30 phút; ngủ máy trên 30 phút; chọn PDF lớn, ngắt/bật mạng và thử lại; tải PDF khác rồi xác minh lại yêu cầu cũ; bấm giao đề lặp; tài khoản lớp khác không thấy đề; học sinh nộp bài và giáo viên chấm như trước.

Nguồn kỹ thuật đã đối chiếu:

- [MDN – giới hạn của sự kiện beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [Supabase – resumable uploads và signed upload tokens](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase – client SSR và getClaims](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
