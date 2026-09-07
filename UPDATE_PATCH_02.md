# Physics Exam Portal - Patch 02

## Muc tieu
1. Mat mang lien tuc 30 giay: client danh dau phien het hieu luc; thiet bi khac duoc phep dang nhap sau khi heartbeat cu qua 30 giay.
2. PDF de thi: bo duong TUS dang gay loi cho tep <= 25 MB; dung Supabase signed upload truc tiep, sau do server xac minh metadata + magic bytes nhu cu.

## File thay doi
- components/session-guard.tsx
- lib/session.ts
- lib/upload.ts
- lib/http.ts
- supabase/migrations/009_presence_30s.sql
- tests/session.test.ts

## Cach cap nhat
1. Backup E:\\physics-exam-portal.
2. Copy cac thu muc trong patch vao E:\\physics-exam-portal va Replace.
3. Supabase SQL Editor: chay supabase/migrations/009_presence_30s.sql mot lan.
4. Tai CMD:
   npm run build
5. Neu build thanh cong:
   git add .
   git commit -m "Fix 30s offline session and PDF upload"
   git push
6. Cho Vercel deployment moi o trang thai Ready.

## Kiem thu
### Offline
- Dang nhap may A.
- Tat Wi-Fi tren may A, cho 30 giay.
- May B thu dang nhap cung tai khoan: phai duoc phep.
- Bat lai mang may A: may A phai ve trang login.

### PDF
- Teacher tao/vao exam draft.
- Upload PDF 1-5 MB truoc; sau do thu PDF 10-25 MB.
- Phai hien "Da tai va xac minh" va xem lai duoc PDF.

## Luu y
Khong can chay lai migration 001-008. Khong xoa Supabase data. Khong thay doi next.config.ts/package.json.
