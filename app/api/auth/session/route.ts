import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { serverClient } from '@/lib/supabase/server';
import { deviceHash } from '@/lib/auth';
import { checkOrigin, checked, fail, readJson } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const b = z
      .object({
        op: z.enum(['open', 'heartbeat', 'close']),
        tab_id: z.uuid(),
        activity_age_ms: z.number().int().min(0).max(1800000).nullable().optional(),
      })
      .parse(await readJson(req));
    const token = (await cookies()).get('portal_device')?.value;
    if (!token) throw new Error('UNAUTHORIZED');
    // PostgREST verifies the JWT; the RPC verifies session, fingerprint and expiry atomically.
    const db = await serverClient();
    return NextResponse.json(
      checked(
        await db.rpc('portal_session', {
          op: b.op,
          tid: b.tab_id,
          fingerprint: deviceHash(token),
          activity_age_ms: b.activity_age_ms ?? null,
        }),
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
