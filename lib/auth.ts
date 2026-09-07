import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/env';
import type { Profile, Role } from '@/types/domain';
export const deviceHash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function authContext() {
  if (!isConfigured()) throw new Error('SETUP_REQUIRED');
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  const token = (await cookies()).get('portal_device')?.value;
  if (!profile || !profile.active || !token) throw new Error('DEVICE_DENIED');
  const { data: d } = await db
    .from('user_devices')
    .select('device_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single();
  if (!d || d.device_id !== deviceHash(token)) throw new Error('DEVICE_DENIED');
  return { db, user, profile: profile as Profile };
}
export async function requireRole(roles: Role[]) {
  try {
    const ctx = await authContext();
    if (!roles.includes(ctx.profile.role)) redirect('/' + ctx.profile.role);
    return ctx;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('NEXT_REDIRECT')) throw e;
    redirect('/login');
  }
}
