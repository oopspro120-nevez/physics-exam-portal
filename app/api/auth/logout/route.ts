import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { checkOrigin, fail } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const db = await serverClient();
    await db.auth.signOut({ scope: 'local' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
