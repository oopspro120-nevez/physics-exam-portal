'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, FileText, ExternalLink } from 'lucide-react';
import { uploadFile, type UploadProgress } from '@/lib/upload';
export { uploadFile } from '@/lib/upload';
import type { Asset } from '@/types/domain';
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
  const lastFile = useRef<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  async function send(file: File) {
    if (busy) return;
    lastFile.current = file;
    setBusy(true);
    setError('');
    setDone('');
    const uploadEventId = crypto.randomUUID();
    window.dispatchEvent(
      new CustomEvent('portal-upload-state', { detail: { id: uploadEventId, busy: true } }),
    );
    try {
      await uploadFile(file, bucket, examId, problemId, setProgress);
      setDone('Đã tải và xác minh: ' + file.name);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải lên.');
    } finally {
      setBusy(false);
      window.dispatchEvent(
        new CustomEvent('portal-upload-state', { detail: { id: uploadEventId, busy: false } }),
      );
    }
  }
  return (
    <div className="stack">
      <label
        className="file-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && !busy) void send(file);
        }}
      >
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void send(file);
          }}
        />
      </label>
      {busy && progress && <UploadStatus progress={progress} />}
      {error && (
        <div className="notice danger" role="alert">
          {error}
          <button
            type="button"
            className="button compact"
            disabled={busy}
            onClick={() => lastFile.current && void send(lastFile.current)}
          >
            Thử lại
          </button>
        </div>
      )}
      {done && (
        <p className="notice success" role="status">
          {done}
        </p>
      )}
    </div>
  );
}
export function UploadStatus({ progress }: { progress: UploadProgress }) {
  return (
    <div className="upload-status" role="status">
      <span>
        {progress.phase === 'preparing'
          ? 'Đang chuẩn bị tệp…'
          : progress.phase === 'verifying'
            ? 'Đã tải 100% · Đang xác minh tệp…'
            : progress.phase === 'done'
              ? 'Tệp đã sẵn sàng'
              : `Đang tải ${progress.percent}%`}
      </span>
      <progress max={100} value={progress.percent} aria-label="Tiến độ tải tệp" />
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
