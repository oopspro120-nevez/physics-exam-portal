'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, FileText, ExternalLink } from 'lucide-react';
import { uploadClient } from '@/lib/supabase/browser';
import { validateFile } from '@/utils/files';
import type { Asset } from '@/types/domain';
export async function uploadFile(file: File, bucket: string, examId: string, problemId?: string) {
  validateFile(file, bucket);
  const r = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
      bucket,
      exam_id: examId,
      problem_id: problemId,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  const { error } = await uploadClient()
    .storage.from(bucket)
    .uploadToSignedUrl(d.path, d.token, file, { contentType: file.type });
  if (error) throw new Error('Tải lên chưa thành công. Kiểm tra kết nối và thử lại.');
  const f = await fetch('/api/files', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: d.asset.id }),
  });
  const final = await f.json();
  if (!f.ok) throw new Error(final.error);
  return { ...d.asset, ready: true } as Asset;
}
export function FileUpload({
  bucket,
  examId,
  problemId,
  label,
}: {
  bucket: Asset['bucket'];
  examId: string;
  problemId?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const router = useRouter();
  return (
    <div className="stack">
      <label className="file-drop">
        {busy ? (
          <Loader2 className="spin" size={24} style={{ margin: 'auto' }} />
        ) : (
          <Upload size={24} style={{ margin: 'auto' }} />
        )}
        {label}
        <span className="small muted">
          {bucket === 'exams' ? 'PDF · tối đa 25 MB' : 'PDF, JPG, PNG · tối đa 15 MB'}
        </span>
        <input
          type="file"
          accept={bucket === 'exams' ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError('');
            setDone('');
            try {
              await uploadFile(file, bucket, examId, problemId);
              setDone('Đã tải và xác minh: ' + file.name);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Không thể tải lên.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="notice success" role="status">
          {done}
        </p>
      )}
    </div>
  );
}
export async function fileUrl(id: string) {
  const r = await fetch('/api/files?id=' + id, { cache: 'no-store' });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d.url as string;
}
export function FileLink({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <span>
      <button
        type="button"
        className="button compact"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          const tab = window.open('about:blank', '_blank');
          if (tab) tab.opener = null;
          try {
            const url = await fileUrl(id);
            if (tab) tab.location.replace(url);
            else setError('Trình duyệt đã chặn cửa sổ mới. Hãy cho phép pop-up để mở tệp.');
          } catch (e) {
            tab?.close();
            setError(e instanceof Error ? e.message : 'Không thể mở tệp.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileText size={15} />
        {name}
        <ExternalLink size={13} />
      </button>
      {error && (
        <span className="small" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
