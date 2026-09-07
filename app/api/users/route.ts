import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { createUsersSchema } from '@/lib/validation';
import { checkOrigin, checked, fail, readJson } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { db, profile } = await authContext();
    const body = createUsersSchema.parse(await readJson(req));
    if (profile.role === 'student' || (body.role === 'teacher' && profile.role !== 'admin'))
      throw new Error('FORBIDDEN');
    if (
      body.role === 'student' &&
      (!body.class_id || !checked(await db.rpc('manages_class', { cid: body.class_id })))
    )
      throw new Error('FORBIDDEN');
    const admin = adminClient();
    const results = [];
    for (const u of body.users) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.username + '@users.physics-portal.invalid',
        password: u.password,
        email_confirm: true,
        app_metadata: {
          portal_role: body.role,
          portal_username: u.username,
          portal_name: u.full_name,
          portal_created_by: profile.id,
        },
      });
      if (error) {
        results.push({
          username: u.username,
          ok: false,
          error: error.message.includes('already')
            ? 'Tên đăng nhập đã tồn tại.'
            : 'Không thể tạo tài khoản. Kiểm tra tên đăng nhập và chính sách mật khẩu.',
        });
        continue;
      }
      if (body.role === 'student') {
        const r = await db.rpc('manage', {
          action: 'enroll',
          payload: { class_id: body.class_id, student_id: data.user.id },
        });
        if (r.error) {
          const rollback = await admin.auth.admin.deleteUser(data.user.id);
          results.push({
            username: u.username,
            ok: false,
            error: rollback.error
              ? 'Đã tạo tài khoản nhưng chưa thêm vào lớp. Quản trị viên cần xử lý tài khoản này.'
              : 'Không thể thêm vào lớp. Tài khoản vừa tạo đã được thu hồi.',
          });
          continue;
        }
      }
      results.push({
        username: u.username,
        full_name: u.full_name,
        password: u.password,
        ok: true,
      });
    }
    return NextResponse.json({ results });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    const { db, profile } = await authContext();
    const body = z
      .object({ id: z.uuid(), password: z.string().min(10).max(128) })
      .parse(await readJson(req));
    const { data: target } = await db.from('profiles').select('role').eq('id', body.id).single();
    if (
      !target ||
      profile.role === 'student' ||
      (profile.role !== 'admin' &&
        (target.role !== 'student' || !checked(await db.rpc('manages_student', { sid: body.id }))))
    )
      throw new Error('FORBIDDEN');
    const { error } = await adminClient().auth.admin.updateUserById(body.id, {
      password: body.password,
    });
    if (error) throw new Error(error.message);
    checked(await db.rpc('manage', { action: 'reset_device', payload: { id: body.id } }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
