import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Hãy điền .env.local trước khi tạo Admin.');

// Report the server's diagnostic without printing credentials or the request body.
function supabaseFailure(context, error, password = '') {
  const safe = (value) => {
    let text = String(value ?? 'không có');
    for (const secret of [key, password]) {
      if (secret) text = text.replaceAll(secret, '[đã ẩn]');
    }
    return text
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[đã ẩn khóa]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[đã ẩn token]')
      .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 800);
  };
  const lines = [
    context,
    `Mã lỗi Supabase: ${safe(error.code)}`,
    `HTTP: ${safe(error.status)}`,
    `Chi tiết: ${safe(error.message)}`,
    `Thời điểm (UTC): ${new Date().toISOString()}`,
  ];
  if (error.code === 'unexpected_failure' || /database error/i.test(error.message || '')) {
    lines.push(
      'Mở Supabase Dashboard → Logs → Auth; xem lỗi cùng thời điểm. Nếu lỗi thuộc database, xem thêm Postgres logs.',
    );
  }
  return new Error(lines.join('\n'));
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { count, error } = await db
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'admin');
if (error) throw supabaseFailure('Không đọc được database để kiểm tra Admin hiện có.', error);
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
  if (!/^[a-z0-9._-]{3,40}$/.test(username))
    throw new Error(
      'Tên đăng nhập cần 3–40 ký tự: a-z, 0-9, dấu chấm, gạch dưới hoặc gạch ngang; không dùng khoảng trắng hoặc @.',
    );
  if (!fullName || fullName.length > 150) throw new Error('Họ và tên cần từ 1 đến 150 ký tự.');
  if (password.length < 12 || password.length > 128)
    throw new Error(
      'Mật khẩu cần từ 12 đến 128 ký tự. Màn hình ẩn ký tự nhưng vẫn nhận nội dung khi gõ hoặc dán.',
    );
  const { error } = await db.auth.admin.createUser({
    email: username + '@users.physics-portal.invalid',
    password,
    email_confirm: true,
    app_metadata: { portal_role: 'admin', portal_username: username, portal_name: fullName },
  });
  if (error) throw supabaseFailure('Supabase chưa tạo được tài khoản Admin.', error, password);
  console.log(
    'Đã tạo Admin. Mở /login và dùng tên đăng nhập vừa tạo. Không có dữ liệu mẫu được thêm.',
  );
} finally {
  rl.close();
}
