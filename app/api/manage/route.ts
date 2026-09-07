import { NextResponse } from 'next/server';
import { authContext } from '@/lib/auth';
import { schemas } from '@/lib/validation';
import { checkOrigin, checked, fail, readJson } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { db } = await authContext();
    const body = await readJson(req);
    const key = body.action as keyof typeof schemas;
    if (!(key in schemas)) throw new Error('UNKNOWN_ACTION');
    const payload = schemas[key].parse(body.payload);
    return NextResponse.json(checked(await db.rpc('manage', { action: key, payload })));
  } catch (e) {
    return fail(e);
  }
}
