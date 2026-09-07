'use client';
import { publicEnv } from '@/lib/env';
import { uploadClient } from '@/lib/supabase/browser';
import { fileMime, sniffMime, validateFile } from '@/utils/files';
import type { Asset } from '@/types/domain';

export type UploadProgress = {
  phase: 'preparing' | 'uploading' | 'verifying' | 'done';
  percent: number;
};

type Job = {
  id: string;
  created: number;
  asset?: Asset;
  token?: string;
  uploaded?: boolean;
  progress?: (p: UploadProgress) => void;
};

// Keep a ticket only in this page so retry never creates duplicate file records.
const jobs = new WeakMap<File, Map<string, Job>>();

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function jsonRequest(method: string, payload: unknown) {
  for (let attempt = 0; ; attempt++) {
    let retryable = true;
    try {
      const r = await fetch('/api/files', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      retryable = r.status === 408 || r.status === 429 || r.status >= 500;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Máy chủ chưa phản hồi. Vui lòng thử lại.');
      return d;
    } catch (e) {
      if (!retryable || attempt >= 2) throw e;
      await sleep((attempt + 1) * 1000);
    }
  }
}

async function verifyUploadedAsset(id: string) {
  await jsonRequest('PATCH', { id });
}

async function signedDirectUpload(
  file: File,
  bucket: string,
  path: string,
  token: string,
  type: string,
  assetId: string,
  progress?: (p: UploadProgress) => void,
) {
  // The portal limits files to 25 MB, so the signed Storage upload is simpler and
  // more reliable than keeping a separate TUS connection through restrictive networks.
  // Supabase Storage receives the bytes directly; they never pass through Vercel.
  publicEnv(); // Fail early with the portal's existing SETUP_REQUIRED behavior.
  const client = uploadClient();
  let lastMessage = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    progress?.({ phase: 'uploading', percent: attempt === 0 ? 25 : 50 + attempt * 10 });
    const { error } = await client.storage.from(bucket).uploadToSignedUrl(path, token, file, {
      contentType: type,
      cacheControl: '3600',
    });
    if (!error) return;

    lastMessage = error.message || String(error);
    // A proxy can drop the final response even though Storage committed the object.
    // Verify immediately before attempting another full upload to the same path.
    try {
      progress?.({ phase: 'verifying', percent: 100 });
      await verifyUploadedAsset(assetId);
      return;
    } catch {
      await sleep((attempt + 1) * 1200);
    }
  }

  throw new Error(
    'Không thể tải tệp lên Supabase Storage. Hãy kiểm tra mạng rồi bấm Thử lại.' +
      (lastMessage ? ` (${lastMessage})` : ''),
  );
}

export async function uploadFile(
  file: File,
  bucket: string,
  examId: string,
  problemId?: string,
  onProgress?: (p: UploadProgress) => void,
) {
  validateFile(file, bucket);
  const type = fileMime(file);
  if (sniffMime(new Uint8Array(await file.slice(0, 16).arrayBuffer())) !== type)
    throw new Error(
      'Nội dung tệp không đúng định dạng. Hãy chọn tệp PDF/ảnh gốc, không chỉ đổi tên phần mở rộng.',
    );

  let group = jobs.get(file);
  if (!group) {
    group = new Map();
    jobs.set(file, group);
  }
  const key = `${bucket}/${examId}/${problemId || ''}`;
  let job = group.get(key);
  if (!job || Date.now() - job.created > 105 * 60000) {
    job = { id: crypto.randomUUID(), created: Date.now() };
    group.set(key, job);
  }

  const active = job;
  active.progress = onProgress;
  onProgress?.({ phase: 'preparing', percent: 0 });

  if (!active.asset) {
    const ticket = await jsonRequest('POST', {
      upload_id: active.id,
      bucket,
      exam_id: examId,
      problem_id: problemId,
      name:
        file.name.length <= 180
          ? file.name
          : file.name.slice(0, 170) + '.' + file.name.split('.').pop(),
      size: file.size,
      type,
    });
    active.asset = ticket.asset;
    active.token = ticket.token;
    active.uploaded = ticket.ready === true;
  }

  if (!active.uploaded) {
    try {
      await signedDirectUpload(
        file,
        bucket,
        active.asset!.path,
        active.token!,
        type,
        active.asset!.id,
        active.progress,
      );
      active.uploaded = true;
    } catch (uploadError) {
      // If the last Storage response was lost, verification can still prove that the
      // object arrived successfully and prevents an unnecessary duplicate upload.
      try {
        onProgress?.({ phase: 'verifying', percent: 100 });
        await verifyUploadedAsset(active.asset!.id);
        active.uploaded = true;
        onProgress?.({ phase: 'done', percent: 100 });
        return { ...active.asset!, ready: true } as Asset;
      } catch {
        throw uploadError;
      }
    }
  }

  onProgress?.({ phase: 'verifying', percent: 100 });
  await verifyUploadedAsset(active.asset!.id);
  onProgress?.({ phase: 'done', percent: 100 });
  return { ...active.asset!, ready: true } as Asset;
}
