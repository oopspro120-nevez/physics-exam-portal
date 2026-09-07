'use client';
import { useEffect, useState } from 'react';
import { Upload, ArrowUp, ArrowDown, X, GripVertical, FileText } from 'lucide-react';
import { uploadFile, fileUrl } from '@/components/file-upload';
import { MAX_SOLUTION_FILES } from '@/utils/files';
import type { Asset } from '@/types/domain';
function Preview({ asset }: { asset: Asset }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    fileUrl(asset.id)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [asset.id]);
  return asset.mime_type.startsWith('image/') && url ? (
    <img src={url} alt={asset.name} />
  ) : (
    <FileText size={28} color="var(--cyan)" />
  );
}
export function SolutionUpload({
  examId,
  problemId,
  files,
  onChange,
  disabled,
  onBusy,
}: {
  examId: string;
  problemId: string;
  files: Asset[];
  onChange: (f: Asset[]) => void;
  disabled: boolean;
  onBusy: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [drag, setDrag] = useState<number | null>(null);
  function move(from: number, to: number) {
    if (to < 0 || to >= files.length) return;
    const copy = [...files];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    onChange(copy);
  }
  async function add(list: FileList | null) {
    if (!list) return;
    const pending = Array.from(list);
    if (files.length + pending.length > MAX_SOLUTION_FILES) {
      setMessage('Tối đa 6 tệp cho mỗi lần nộp.');
      return;
    }
    setBusy(true);
    onBusy(true);
    setMessage('');
    const next = [...files];
    try {
      for (const f of pending) {
        setMessage('Đang tải ' + f.name + '...');
        next.push(await uploadFile(f, 'submissions', examId, problemId));
        onChange([...next]);
      }
      setMessage('Đã tải lên. Tệp sẽ được gắn vào lần nộp đáp án tiếp theo.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không thể tải tệp.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="file-drop" style={{ padding: 17 }}>
        <Upload size={22} style={{ margin: 'auto' }} />
        PDF hoặc ảnh lời giải<span className="small muted">Tối đa 6 tệp · 15 MB/tệp</span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={disabled || busy}
          onChange={(e) => add(e.target.files)}
        />
      </label>
      {files.map((f, i) => (
        <div
          className="file-item"
          key={f.id}
          draggable={!disabled && !busy}
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (drag !== null) move(drag, i);
            setDrag(null);
          }}
        >
          <GripVertical size={15} className="muted" />
          <Preview asset={f} />
          <span className="file-name">
            {i + 1}. {f.name}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Đưa tệp lên"
              disabled={disabled || busy || i === 0}
              onClick={() => move(i, i - 1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              className="icon-button"
              aria-label="Đưa tệp xuống"
              disabled={disabled || busy || i === files.length - 1}
              onClick={() => move(i, i + 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              className="icon-button"
              aria-label="Bỏ tệp khỏi lần nộp"
              disabled={disabled || busy}
              onClick={() => onChange(files.filter((x) => x.id !== f.id))}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      {message && (
        <p className="small muted" role="status" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
