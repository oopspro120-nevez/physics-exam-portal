import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/env';
import { cache } from 'react';
import { checked } from '@/lib/http';
import type { Profile, Role } from '@/types/domain';
export const deviceHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const authContext = cache(async () => {
  if (!isConfigured()) throw new Error('SETUP_REQUIRED');
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims.sub) throw new Error('UNAUTHORIZED');
  const token = (await cookies()).get('portal_device')?.value;
  if (!token) throw new Error('UNAUTHORIZED');
  const context = checked(await db.rpc('portal_context', { fingerprint: deviceHash(token) }));
  if (!context?.profile) throw new Error('SESSION_EXPIRED');
  return {
    db,
    user: { id: data.claims.sub },
    profile: context.profile as Profile,
    session: context as { session_id: string; expires_at: string; server_time: string },
  };
});
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
