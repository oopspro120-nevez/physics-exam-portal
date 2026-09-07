import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authContext } from '@/lib/auth';
import { checkOrigin, checked, fail, readJson } from '@/lib/http';
export async function GET(req: Request) {
  try {
    const { db, profile } = await authContext();
    if (profile.role !== 'student') throw new Error('FORBIDDEN');
    const id = z.uuid().parse(new URL(req.url).searchParams.get('id'));
    return NextResponse.json(checked(await db.rpc('contest_data', { eid: id })), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return fail(e);
  }
}
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), exam_id: z.uuid() }),
  z.object({ action: z.literal('finish'), exam_id: z.uuid() }),
  z.object({
    action: z.literal('draft'),
    problem_id: z.uuid(),
    answer: z.string().max(20000),
    unit: z.string().max(80),
    revision: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal('submit'),
    problem_id: z.uuid(),
    answer: z.string().max(20000),
    unit: z.string().max(80),
    file_ids: z.array(z.uuid()).max(6),
    request_id: z.uuid(),
  }),
  z.object({
    action: z.literal('ask'),
    problem_id: z.uuid(),
    question: z.string().trim().min(1).max(2000),
  }),
]);
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { db, profile } = await authContext();
    if (profile.role !== 'student') throw new Error('FORBIDDEN');
    const b = schema.parse(await readJson(req));
    let r;
    switch (b.action) {
      case 'start':
        r = await db.rpc('start_exam', { eid: b.exam_id });
        break;
      case 'finish':
        r = await db.rpc('finish_exam', { eid: b.exam_id });
        break;
      case 'draft':
        r = await db.rpc('save_draft', {
          pid: b.problem_id,
          value: b.answer,
          input_unit: b.unit,
          expected_revision: b.revision,
        });
        break;
      case 'submit':
        r = await db.rpc('submit_answer', {
          pid: b.problem_id,
          value: b.answer,
          input_unit: b.unit,
          file_ids: b.file_ids,
          request_key: b.request_id,
        });
        break;
      case 'ask':
        r = await db.rpc('ask_clarification', { pid: b.problem_id, question_text: b.question });
        break;
    }
    return NextResponse.json(checked(r) ?? { ok: true });
  } catch (e) {
    return fail(e);
  }
}
