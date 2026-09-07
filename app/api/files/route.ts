import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { checkOrigin, checked, fail, readJson } from '@/lib/http';
import { validateFile, sniffMime } from '@/utils/files';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { db, profile } = await authContext();
    const b = z
      .object({
        bucket: z.enum(['exams', 'submissions', 'solutions']),
        exam_id: z.uuid(),
        problem_id: z.uuid().optional(),
        name: z.string().min(1).max(180),
        size: z.number().int().positive(),
        type: z.string(),
      })
      .parse(await readJson(req));
    const ext = validateFile(b, b.bucket);
    const e = checked(
      await db.from('exams').select('id,class_id,start_time').eq('id', b.exam_id).single(),
    );
    if (!e) throw new Error('FORBIDDEN');
    const id = randomUUID(),
      year = new Date(e.start_time).getUTCFullYear();
    const path =
      b.bucket === 'exams'
        ? `${year}/${e.class_id}/${e.id}/${id}.pdf`
        : b.bucket === 'solutions'
          ? `${e.id}/${b.problem_id}/${id}.${ext}`
          : `${year}/${e.class_id}/${e.id}/${profile.id}/${b.problem_id}/${id}.${ext}`;
    const asset = checked(
      await db.rpc('register_file', {
        payload: {
          id,
          bucket: b.bucket,
          exam_id: b.exam_id,
          problem_id: b.problem_id,
          path,
          name: b.name,
          mime_type: b.type,
          size_bytes: b.size,
        },
      }),
    );
    const signed = checked(
      await adminClient().storage.from(b.bucket).createSignedUploadUrl(path, { upsert: false }),
    );
    if (!signed) throw new Error('INVALID_FILES');
    return NextResponse.json({ asset, token: signed.token, path });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    const { db } = await authContext();
    const { id } = z.object({ id: z.uuid() }).parse(await readJson(req));
    const f = checked(await db.from('file_assets').select('*').eq('id', id).single());
    if (!f) throw new Error('FORBIDDEN');
    if (f.ready) return NextResponse.json({ ok: true });
    const admin = adminClient();
    const info = checked(await admin.storage.from(f.bucket).info(f.path));
    if (!info) throw new Error('INVALID_FILES');
    const size = Number(info.size ?? info.metadata?.size);
    if (size !== f.size_bytes || (info.contentType ?? info.metadata?.mimetype) !== f.mime_type)
      throw new Error('INVALID_FILES');
    const signed = checked(await admin.storage.from(f.bucket).createSignedUrl(f.path, 60));
    // Chỉ lấy header tệp để xác minh định dạng; không đưa tệp lớn qua server ứng dụng.
    if (!signed) throw new Error('INVALID_FILES');
    const response = await fetch(signed.signedUrl, {
      headers: { Range: 'bytes=0-15' },
      cache: 'no-store',
    });
    if (!response.ok || !response.body) throw new Error('INVALID_FILES');
    const reader = response.body.getReader();
    const header = new Uint8Array(16);
    let read = 0;
    try {
      while (read < 16) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const count = Math.min(16 - read, chunk.value.length);
        header.set(chunk.value.slice(0, count), read);
        read += count;
      }
    } finally {
      await reader.cancel();
    }
    const mime = sniffMime(header.slice(0, read));
    if (mime !== f.mime_type) throw new Error('INVALID_FILES');
    checked(await admin.rpc('complete_file', { fid: id, actual_size: size, actual_mime: mime }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
export async function GET(req: Request) {
  try {
    const { db } = await authContext();
    const id = z.uuid().parse(new URL(req.url).searchParams.get('id'));
    const f = checked(
      await db.from('file_assets').select('*').eq('id', id).eq('ready', true).single(),
    );
    if (!f) throw new Error('FORBIDDEN');
    const data = checked(await db.storage.from(f.bucket).createSignedUrl(f.path, 120));
    if (!data) throw new Error('INVALID_FILES');
    return NextResponse.json(
      { url: data.signedUrl, mime: f.mime_type, name: f.name },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
