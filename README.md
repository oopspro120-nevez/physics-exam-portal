# PHYSICS EXAM PORTAL

Cổng giao đề, làm bài và chấm thi Vật lý/Olympiad. Luồng làm việc: **Admin → Giáo viên → Lớp → Kỳ thi → PDF → Problems → Nộp bài → Chấm điểm**.

Ứng dụng dùng **Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, @supabase/supabase-js và @supabase/ssr**. Không có dữ liệu mẫu trong ứng dụng. Khi thiếu cấu hình Supabase, trang đăng nhập thông báo chưa kết nối và không giả lập hoạt động.

**Trạng thái bàn giao:** các luồng chức năng đã được viết và build. Database/RLS được kiểm thử bằng PostgreSQL chạy trong PGlite. Chưa kết nối dự án Supabase thật; chưa xác nhận vận hành Auth, Storage và các luồng trình duyệt với tài khoản thật. Xem `docs/PHASE6_REPORT.md` và `docs/ACCEPTANCE.md` trước khi dùng cho một kỳ thi chính thức.

## Cập nhật tháng 9/2026

Bổ sung tự kết thúc phiên sau 30 phút không thao tác, giải phóng thiết bị khi đăng xuất, xử lý đóng nhiều tab, upload PDF có thể tiếp tục, tạo/giao đề chống trùng và giao diện soạn đề theo từng bước. Các trang tải đúng nhóm dữ liệu cần dùng.

**Hệ thống đã chạy 001–006:** chỉ áp dụng thêm `007_session_lifecycle.sql`, rồi `008_upload_and_publish.sql` trước khi triển khai mã nguồn mới. Hệ thống mới chạy đủ 001–008 theo thứ tự. Xem **[hướng dẫn cập nhật, giới hạn và phương án vận hành khoảng 20 người](docs/UPGRADE_2026_09.md)**. Không chạy lại bộ khởi tạo trên dữ liệu đang sử dụng.

## 1. Cài Node.js

1. Tải bản Node.js 24 cho hệ điều hành đang dùng tại [nodejs.org](https://nodejs.org/en/download).
2. Cài với các tùy chọn mặc định, rồi đóng/mở lại Terminal hoặc PowerShell.
3. Kiểm tra:

```bash
node --version
npm --version
```

Dự án được build trong môi trường Node.js 24.19.0. Không dùng Node.js quá cũ.

## 2. Mở dự án và cài dependencies

Giải nén mã nguồn. Mở Terminal ngay trong thư mục có `package.json`.

```bash
npm install
```

`package-lock.json` đi kèm cố định phiên bản đã kiểm tra. Khi triển khai tự động, dùng `npm ci`.

## 3. Tạo `.env.local`

Sao chép `.env.example`, đổi tên bản sao thành `.env.local`. Trên Windows, bật hiển thị phần mở rộng để tránh tên `.env.local.txt`.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TEN_DU_AN.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DIEN_KHOA_CUA_BAN
SUPABASE_SECRET_KEY=sb_secret_DIEN_KHOA_CUA_BAN
APP_URL=http://localhost:3000
```

| Biến                                   | Dùng ở đâu                    | Ý nghĩa                                                                        |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser và server             | Địa chỉ dự án Supabase                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser và server             | Khóa publishable; quyền dữ liệu do RLS quyết định                              |
| `SUPABASE_SECRET_KEY`                  | Chỉ server và script quản trị | Tạo/reset tài khoản, xác nhận thiết bị và cấp quyền upload                     |
| `APP_URL`                              | Chỉ server                    | Origin chính xác để kiểm tra yêu cầu ghi, gồm giao thức và cổng khi chạy local |

Không đưa Secret Key vào biến có tiền tố `NEXT_PUBLIC_`. Không gửi file `.env.local` hoặc database password lên Git. Không nhập khóa bí mật vào form của website. Chỉnh biến môi trường xong phải khởi động lại ứng dụng; khi deploy cần build lại để cập nhật các biến public.

## 4. Tạo và kết nối Supabase

1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard), tạo **một dự án mới dành riêng cho cổng thi**.
2. Trong hộp **Connect / API Keys** của dự án, lấy Project URL, Publishable Key và Secret Key. Điền vào `.env.local`.
3. Trong Authentication, dùng Email/Password. Học sinh đăng nhập bằng username; ứng dụng ánh xạ nội bộ thành `username@users.physics-portal.invalid`. Đây không phải địa chỉ email để nhận thư.
4. Tắt đăng ký tài khoản công khai. Chỉ Admin/giáo viên được cấp tài khoản qua backend. Trigger database cũng từ chối tài khoản không có thông tin cấp phát do Auth Admin API đặt.
5. Đặt Site URL trong Supabase Auth theo địa chỉ website. Khi chạy local dùng `http://localhost:3000`.
6. Không thêm schema `private` vào danh sách schema được Data API expose.

Không cần cài plugin Supabase trong ChatGPT để tự chạy dự án theo hướng dẫn này.

Nguồn tham khảo: [Supabase với Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## 5. Chạy migration

Trong Supabase Dashboard → **SQL Editor**, mở lần lượt các file dưới đây, sao chép toàn bộ nội dung và Run. Chỉ chuyển sang file kế tiếp khi file trước chạy thành công.

| Thứ tự | File                                              | Nội dung                                                 |
| ------ | ------------------------------------------------- | -------------------------------------------------------- |
| 1      | `supabase/migrations/001_schema.sql`              | Tables, kiểu dữ liệu, khóa ngoại, chỉ mục, constraints   |
| 2      | `supabase/migrations/002_rls.sql`                 | RLS, quyền đọc, các hàm kiểm tra vai trò/lớp/thiết bị    |
| 3      | `supabase/migrations/003_auth_and_management.sql` | Cấp phát profile, device binding, quản trị và chấm bài   |
| 4      | `supabase/migrations/004_files.sql`               | Đăng ký metadata và xác nhận file                        |
| 5      | `supabase/migrations/005_contest.sql`             | Phiên thi, timer, autosave, attempts, tính điểm, kết quả |
| 6      | `supabase/migrations/006_storage.sql`             | Ba bucket private và Storage RLS                         |
| 7 | `supabase/migrations/007_session_lifecycle.sql` | Hết hạn phiên, nhiều tab, giải phóng thiết bị |
| 8 | `supabase/migrations/008_upload_and_publish.sql` | Thử lại upload/tạo đề/giao đề an toàn |

Đây là bộ migration khởi tạo. Không chạy lại toàn bộ trên database đã có cấu trúc này. Không tắt RLS khi gặp lỗi quyền; kiểm tra thứ tự migration và thông tin kết nối. Sau khi đã đưa hệ thống vào sử dụng, mọi thay đổi schema phải thành migration mới; không sửa rồi chạy lại các file đã áp dụng.

Có thể dùng Supabase CLI `db push` thay SQL Editor nếu người phụ trách kỹ thuật đã liên kết đúng dự án. Chỉ chọn **một** cách quản lý migration để tránh lệch lịch sử.

## 6. Storage bucket

Migration 006 tự tạo:

| Bucket        | Public? | Giới hạn mỗi tệp | Loại tệp           |
| ------------- | ------- | ---------------- | ------------------ |
| `exams`       | Không   | 25 MB            | PDF                |
| `submissions` | Không   | 15 MB            | PDF, JPG/JPEG, PNG |
| `solutions`   | Không   | 15 MB            | PDF, JPG/JPEG, PNG |

Mỗi lần nộp có tối đa 6 tệp; sắp xếp bằng kéo thả hoặc nút lên/xuống. Tệp được upload **trực tiếp từ browser sang Storage** bằng signed upload token. Backend chỉ nhận metadata và đọc một đoạn đầu tệp để xác minh chữ ký định dạng. Nội dung tệp không được lưu trên máy chủ chạy website hoặc trong PostgreSQL.

Đường dẫn gồm năm/lớp/kỳ thi/học sinh/Problem và UUID ngẫu nhiên. Tên tệp gốc được lưu riêng trong metadata. UUID giúp tránh ghi đè giữa các lần upload. File đã đính kèm không có quyền UPDATE qua Storage API.

PDF đề chỉ được mở sau khi kỳ thi bắt đầu **và học sinh đã bắt đầu phiên làm bài**, hoặc khi kết quả được công bố sau kỳ thi. Lời giải tham khảo chỉ mở sau khi kết thúc và công bố kết quả.

## 7. Chạy website local

```bash
npm run dev
```

Mở [http://localhost:3000/login](http://localhost:3000/login). Nhấn Ctrl+C trong Terminal để dừng.

Nếu thấy thông báo “Cổng thi đang chờ quản trị viên kết nối hệ thống”, kiểm tra đủ ba biến Supabase trong `.env.local` và khởi động lại.

Kiểm tra bản production:

```bash
npm run build
npm start
```

`npm run build` không cần kết nối Supabase. Việc build thành công không thay thế kiểm thử Auth/Storage trên dịch vụ thật.

## 8. Tạo Admin đầu tiên

Sau khi chạy đủ migration:

```bash
npm run bootstrap-admin
```

Nhập username, họ tên và mật khẩu. Mật khẩu được ẩn khi nhập, yêu cầu tối thiểu 12 ký tự. Script chỉ tạo Admin đầu tiên; nếu đã có Admin, script sẽ dừng. Không có mật khẩu Admin mặc định.

Nếu tạo Admin thất bại, script hiển thị mã lỗi Supabase, HTTP status, thông báo gốc và thời điểm UTC, đồng thời che khóa/mật khẩu trong phần chẩn đoán. Ghi lại phần lỗi để xử lý đúng nguyên nhân; không chạy lại migration hoặc tắt RLS chỉ vì một thông báo lỗi. Với `unexpected_failure`/`Database error`, kiểm tra Auth logs rồi Postgres logs tại cùng thời điểm. Các mã khác được giải thích trong [tài liệu lỗi Supabase Auth](https://supabase.com/docs/guides/auth/debugging/error-codes).

Sau đó:

1. Đăng nhập `/login` bằng username vừa tạo.
2. Vào **Giáo viên** → tạo tài khoản.
3. Vào **Lớp học** → tạo lớp → phân công giáo viên.
4. Giáo viên đăng nhập → **Lớp phụ trách** → thêm học sinh hoặc nhập CSV/XLSX.
5. Tải thông tin tài khoản vừa tạo để bàn giao riêng cho người học. Mật khẩu không được lưu trong bảng profiles.

Nếu Admin bị mất thiết bị, người sở hữu dự án Supabase có thể vào SQL Editor, xác định đúng Admin rồi thu hồi thiết bị của tài khoản đó:

```sql
-- Thay admin_cua_ban bằng username Admin cần khôi phục, không thay đổi vai trò.
begin;
update public.user_devices set active=false
where user_id in (select id from public.profiles where username='admin_cua_ban' and role='admin');
delete from private.device_sessions
where user_id in (select id from public.profiles where username='admin_cua_ban' and role='admin');
commit;
```

Đăng nhập tiếp theo sẽ đăng ký lại thiết bị. Reset thiết bị không tự đổi mật khẩu.

## 9. Deploy production

Ứng dụng Next.js có thể chạy trên môi trường hỗ trợ Next.js 16/Node.js. Khi triển khai lên dịch vụ như Vercel, chọn dự án Next.js, build bằng `npm run build`, và khai báo **đủ các biến ở mục 3**; `APP_URL` phải là origin HTTPS chính xác của tên miền production.

Trình tự:

1. Dùng một database Supabase dành cho production, chạy migration đủ 8 file (001–008).
2. Đưa mã nguồn lên kho Git riêng; không đưa `.env.local`, `node_modules`, `.next`, `backups` lên Git.
3. Cấu hình biến môi trường trong trang quản trị hosting.
4. Build và deploy.
5. Tạo Admin nếu database chưa có Admin.
6. Thực hiện các tình huống trong `docs/ACCEPTANCE.md` với tài khoản kiểm thử trước khi giao đề chính thức.

Bản xuất bản trong ChatGPT Sites dùng adapter OpenNext. Mã nguồn Next.js vẫn là bản chính. Đường chạy Node.js thông thường dùng `npm run build` và `npm start`; `npm run build:worker` là bước đóng gói riêng cho môi trường Workers và phải chạy **sau khi** build Next.js đã hoàn tất. Không chạy đồng thời hai quá trình build vì cùng dùng thư mục `.next`.

Trên Sites, cổng có thể còn một lớp quyền truy cập của nền tảng bên ngoài Supabase. Bản riêng tư của chủ sở hữu không tự trở thành đường link công khai cho học sinh.

## 10. Backup dữ liệu

Cần sao lưu **database và tệp Storage riêng**. Backup database không chứa nội dung PDF/ảnh trong Storage. Đây là điểm được nêu trong [tài liệu backup của Supabase](https://supabase.com/docs/guides/platform/backups).

### Database

Lưu bộ migration cùng mã nguồn. Với dữ liệu đang sử dụng, người phụ trách kỹ thuật cần cài Supabase CLI và Docker Desktop, rồi tạo các bản dump `roles.sql`, `schema.sql`, `data.sql` theo [hướng dẫn backup/restore chính thức](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Hướng dẫn này cũng có phần bảo toàn các thay đổi trong schema `auth` và `storage`.

Dự án này có trigger `auth.users` và policy `storage.objects`, nên phải giữ cả các migration 003 và 006, hoặc bản diff schema tương ứng. Khi phục hồi, cần kiểm tra cả tài khoản Auth, bảng ứng dụng, metadata Storage, trigger, policies và khóa cấu hình. Không chạy lại toàn bộ migration khởi tạo lên một bản schema đã khôi phục.

Không chỉ xuất CSV bảng `profiles`: CSV đó không chứa thông tin xác thực cần thiết để phục hồi tài khoản. Thực hiện phục hồi thử trên **dự án riêng** trước khi áp dụng lên hệ thống đang dùng.

### Tệp Storage

Chạy script ngoài ứng dụng website trên máy của người quản trị:

```bash
npm run backup:storage
```

Script tải tệp từ ba bucket vào thư mục có ngày giờ trong `backups/`. Đây là bản sao lưu ngoại tuyến, không phải nơi website nhận bài. Thư mục này đã được loại khỏi Git. Cất bản sao trên ổ đĩa hoặc nơi lưu trữ riêng có kiểm soát truy cập. Script chỉ sao lưu, không xóa dữ liệu nguồn và không tự phục hồi.

Backup nên thực hiện trước/sau kỳ thi và trước khi thay đổi hệ thống. Ghi rõ thời điểm, dự án nguồn và phạm vi dữ liệu trong mỗi bản sao.

## Quy tắc chấm điểm

- `numeric`: PostgreSQL chuyển chuỗi sang `numeric`; hỗ trợ `3.5`, `3,5`, `3.5e-4`, `3.5E-4`. Không so sánh bằng chuỗi. Giới hạn định dạng: tối đa 80 ký tự, số mũ từ −100 đến 100. `NaN`, `Infinity`, chuỗi sai định dạng bị từ chối.
- Dung sai tuyệt đối: `abs(answer − correct) <= tolerance`.
- Dung sai tương đối: `abs(answer − correct) <= abs(correct) × tolerance`. Nhập `0.01` cho 1%. Khi đáp án chuẩn bằng 0, dung sai tương đối bằng 0; dùng dung sai tuyệt đối nếu cần khoảng khác 0.
- Nếu có đơn vị, học sinh phải nhập đúng đơn vị đã cấu hình; không tự quy đổi đơn vị. So sánh đơn vị bỏ khoảng trắng hai đầu và không phân biệt hoa/thường.
- `text`: so sánh không phân biệt hoa/thường và bỏ khoảng trắng hai đầu. Không dùng AI để chấm.
- `essay`, `file_only`: giáo viên chấm; phần điểm tự động phải bằng 0.
- `points` = tổng ngân sách điểm; `auto_points` = phần tự động; ngân sách tự luận = `points − auto_points`.
- PRACTICE: không phạt thử lại. CHALLENGE: hệ số lượt áp dụng cho cả phần tự động và phần tự luận; hết danh sách hệ số thì dùng hệ số cuối. EXAM: đúng một lần nộp cho mỗi Problem, không hiển thị đúng/sai trước khi công bố.
- `max_attempts = NULL` là không giới hạn trong PRACTICE/CHALLENGE.
- Điểm một Problem = điểm cao nhất trong các lần nộp đã lưu; tổng kỳ thi = tổng điểm các Problem. Điểm tự luận chưa chấm tạm tính 0 và được ghi rõ trên trang kết quả.
- Giáo viên nhập điểm tự luận **trước hệ số**; máy chủ kiểm tra ngân sách rồi áp hệ số. Lưu lại điểm không nhân hệ số thêm lần nữa.
- Lịch sử mỗi lần nộp nằm trong `submissions`; `submission_attempts` là nhật ký liên kết, không sao chép toàn bộ đáp án sang bảng thứ hai.

## Timer, mạng và tệp

`exam_sessions.deadline` được tạo bởi PostgreSQL, bằng thời điểm sớm hơn giữa hạn cuối kỳ thi và lúc bắt đầu cộng thời lượng. Client hiển thị bằng mốc giờ server và bộ đếm đơn điệu `performance.now()`; thời gian gửi bài vẫn được database kiểm tra.

Khi cho phép nộp muộn, bài sau deadline được đánh dấu `is_late`. Giáo viên phải đóng kỳ thi trước khi công bố kết quả nếu còn cho nộp muộn. Khi học sinh bấm **Kết thúc làm bài**, không nhận thêm lần nộp.

Bản nháp lưu cục bộ theo tài khoản/kỳ thi/Problem, rồi đồng bộ sau khoảng 900 ms ngừng gõ. Mất mạng vẫn giữ nội dung; khi có mạng sẽ thử đồng bộ lại. Khi hai tab sửa cùng một Problem, hệ thống yêu cầu chọn bản muốn giữ, không âm thầm ghi đè. Chuyển thiết bị không mang theo phần bản nháp chưa đồng bộ. Xóa dữ liệu trình duyệt sẽ xóa bản nháp cục bộ.

Lần nộp chính thức chỉ thành công sau xác nhận server. Request ID giúp gửi lại một yêu cầu không tạo lượt nộp trùng. File phải được tải xong và xác minh trước khi đính kèm. Bản nháp và file upload chưa gắn vào một lần nộp không tự trở thành bài đã nộp.

Thông báo và giải đáp của học sinh cập nhật mỗi 20 giây khi trang đang hiển thị. Trang chấm bài/giải đáp của giáo viên cập nhật mỗi 30 giây khi không nhập liệu. Bản này chưa triển khai WebSocket/Supabase Realtime hoặc ghép ảnh thành PDF.

## Database và RLS

Các bảng theo yêu cầu: `profiles`, `classes`, `class_students`, `exams`, `problems`, `submissions`, `submission_attempts`, `user_devices`, `clarifications`, `announcements`.

Bảng bổ sung có mục đích riêng:

| Bảng                      | Mục đích                                                                  |
| ------------------------- | ------------------------------------------------------------------------- |
| `problem_keys`            | Tách đáp án, dung sai và lời giải chuẩn khỏi dữ liệu Problem cho học sinh |
| `exam_sessions`           | Mốc bắt đầu, deadline và kết thúc của từng học sinh                       |
| `answer_drafts`           | Bản nháp và phiên bản để chống ghi đè giữa các tab                        |
| `file_assets`             | Metadata, chủ sở hữu, đường dẫn và trạng thái xác minh tệp                |
| `submission_files`        | Liên kết nhiều tệp và thứ tự trong từng lần nộp                           |
| `audit_logs`              | Nhật ký thao tác quản trị/chấm điểm                                       |
| `private.device_sessions` | Gắn JWT session đã được server xác nhận với thiết bị                      |
| `private.login_limits`    | Giới hạn lần thử đăng nhập theo username đã băm                           |

`profiles.created_by` giúp kiểm soát việc đưa tài khoản vừa cấp vào lớp; giáo viên không thể tự nhận học sinh của lớp khác để lấy quyền quản lý tài khoản.

Tất cả bảng ứng dụng bật RLS. Policy không có `USING (true)`. Quyền ghi trực tiếp của `anon`/`authenticated` vào bảng được thu hồi; nghiệp vụ ghi qua RPC kiểm tra vai trò. Raw SELECT `submissions` chỉ dành giáo viên đúng lớp/Admin; học sinh xem lịch sử của chính mình qua RPC đã loại điểm và đáp án chưa công bố. Chi tiết ma trận quyền ở `docs/SECURITY.md`.

## Cấu trúc mã nguồn

- `app/`: routes App Router và API.
- `components/`: giao diện theo chức năng; `contest/` dành cho phòng thi.
- `lib/supabase/`: client browser, server và client quản trị chỉ chạy server.
- `lib/auth.ts`, `lib/http.ts`, `lib/validation.ts`: xác thực, giới hạn yêu cầu, validation.
- `lib/hooks/use-draft.ts`: autosave/offline/conflict.
- `services/`: truy vấn dữ liệu và phân trang.
- `utils/`: định dạng điểm, kiểm tra tệp.
- `supabase/migrations/`: schema, RLS và nghiệp vụ nguyên tử ở PostgreSQL.
- `tests/`: kiểm thử nghiệp vụ và quyền truy cập; dữ liệu trong đây chỉ phục vụ test cục bộ.
- `scripts/`: tạo Admin, backup Storage, đóng gói bản Workers.
- `docs/`: báo cáo Phase 6, bảo mật và kịch bản nghiệm thu.

## Các lệnh kiểm tra

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Phạm vi chưa xác minh trên dịch vụ thật và các bước nghiệm thu được ghi rõ trong tài liệu Phase 6; không coi kết quả kiểm thử cục bộ là xác nhận sẵn sàng tổ chức thi chính thức.
