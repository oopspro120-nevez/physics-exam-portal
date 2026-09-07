import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { checkOrigin, checked, fail } from '@/lib/http';
import { cookies } from 'next/headers';
import { deviceHash } from '@/lib/auth';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const db = await serverClient();
    const jar = await cookies();
    const token = jar.get('portal_device')?.value;
    if (token) checked(await db.rpc('end_portal_session', { fingerprint: deviceHash(token) }));
    await db.auth.signOut({ scope: 'local' });
    jar.delete('portal_device');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
