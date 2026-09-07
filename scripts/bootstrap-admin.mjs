import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Hãy điền .env.local trước khi tạo Admin.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { count, error } = await db
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'admin');
if (error)
  throw new Error('Không đọc được database. Hãy chạy đủ migration và kiểm tra Secret Key.');
if (count > 0) throw new Error('Đã có Admin. Script này chỉ tạo Admin đầu tiên.');
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
try {
  const username = (await rl.question('Tên đăng nhập Admin (a-z, 0-9, ., _, -): '))
    .trim()
    .toLowerCase();
  const fullName = (await rl.question('Họ và tên: ')).trim();
  process.stdout.write('Mật khẩu (ít nhất 12 ký tự, nội dung sẽ được ẩn): ');
  muted = true;
  const password = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  if (
    !/^[a-z0-9._-]{3,40}$/.test(username) ||
    !fullName ||
    fullName.length > 150 ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error('Thông tin không hợp lệ. Vui lòng chạy lại.');
  const { error } = await db.auth.admin.createUser({
    email: username + '@users.physics-portal.invalid',
    password,
    email_confirm: true,
    app_metadata: { portal_role: 'admin', portal_username: username, portal_name: fullName },
  });
  if (error)
    throw new Error(
  'Mã lỗi Supabase: ' + (error.code || 'không có') +
  '\nHTTP: ' + (error.status || 'không có') +
  '\nChi tiết: ' + String(error.message || '')
    .replaceAll(key, '[đã ẩn khóa]')
    .replaceAll(password, '[đã ẩn mật khẩu]')
);
  console.log(
    'Đã tạo Admin. Mở /login và dùng tên đăng nhập vừa tạo. Không có dữ liệu mẫu được thêm.',
  );
} finally {
  rl.close();
}
