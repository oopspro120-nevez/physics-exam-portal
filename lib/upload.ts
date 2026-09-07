'use client';
import type { Upload } from 'tus-js-client';
import { publicEnv } from '@/lib/env';
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
  uploader?: Upload;
  progress?: (p: UploadProgress) => void;
};
// Retain a ticket only in this page, so retry never creates a duplicate asset or leaks an upload token to disk.
const jobs = new WeakMap<File, Map<string, Job>>();
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
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
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
    const { Upload } = await import('tus-js-client');
    const { url, key: publicKey } = publicEnv();
    const storage = new URL(url);
    // Supabase recommends the direct Storage hostname for resumable uploads.
    if (/^[a-z0-9-]+\.supabase\.co$/.test(storage.hostname))
      storage.hostname = storage.hostname.replace('.supabase.co', '.storage.supabase.co');
    await new Promise<void>((resolve, reject) => {
      const options = {
        endpoint: `${storage.origin}/storage/v1/upload/resumable`,
        headers: { apikey: publicKey, 'x-signature': active.token! },
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        storeFingerprintForResuming: false,
        metadata: {
          bucketName: bucket,
          objectName: active.asset!.path,
          contentType: type,
          cacheControl: '3600',
        },
        onProgress: (sent: number, total: number) =>
          active.progress?.({
            phase: 'uploading',
            percent: Math.min(99, Math.round((sent / total) * 100)),
          }),
        onSuccess: () => {
          active.uploaded = true;
          resolve();
        },
        onError: () =>
          reject(new Error('Tải tệp bị gián đoạn. Giữ trang này và bấm Thử lại để tiếp tục.')),
      };
      if (!active.uploader) active.uploader = new Upload(file, options);
      else Object.assign(active.uploader.options, options);
      active.uploader.start();
    });
  }
  onProgress?.({ phase: 'verifying', percent: 100 });
  await jsonRequest('PATCH', { id: active.asset!.id });
  onProgress?.({ phase: 'done', percent: 100 });
  return { ...active.asset!, ready: true } as Asset;
}
