import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { serverClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { deviceHash } from '@/lib/auth';
import { checkOrigin, fail, readJson } from '@/lib/http';
const schema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  password: z.string().min(1).max(128),
  device_id: z.uuid(),
});
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const b = schema.parse(await readJson(req));
    const admin = adminClient();
    const { data: allowed, error: rateError } = await admin.rpc('check_login_rate', {
      k: deviceHash(b.username),
    });
    if (rateError) throw new Error(rateError.message);
    if (!allowed)
      return NextResponse.json(
        { error: 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
        { status: 429 },
      );
    const db = await serverClient();
    const { data, error } = await db.auth.signInWithPassword({
      email: b.username + '@users.physics-portal.invalid',
      password: b.password,
    });
    if (error || !data.session)
      return NextResponse.json(
        { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' },
        { status: 401 },
      );
    const jar = await cookies();
    const token = jar.get('portal_device')?.value || b.device_id;
    const claims = JSON.parse(
      Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString(),
    );
    const { data: bound, error: bindingError } = await admin.rpc('bind_device', {
      uid: data.user.id,
      fingerprint: deviceHash(token),
      sid: claims.session_id,
      info: req.headers.get('user-agent') || '',
    });
    if (bindingError || !bound) {
      await db.auth.signOut({ scope: 'local' });
      throw new Error(bindingError ? bindingError.message : 'DEVICE_DENIED');
    }
    jar.set('portal_device', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 31536000,
    });
    const { data: p } = await db.from('profiles').select('role').eq('id', data.user.id).single();
    if (!p) throw new Error('FORBIDDEN');
    return NextResponse.json({ redirect: '/' + p.role });
  } catch (e) {
    return fail(e);
  }
}
