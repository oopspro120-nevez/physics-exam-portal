'use client';
import { useEffect, useState } from 'react';
import type { Asset } from '@/types/domain';
import { fileUrl, FileLink } from '@/components/file-upload';
export function AssetViewer({ files }: { files: Asset[] }) {
  const [selected, setSelected] = useState(files[0]?.id || ''),
    [url, setUrl] = useState(''),
    [error, setError] = useState('');
  const file = files.find((f) => f.id === selected) || files[0];
  useEffect(() => {
    let alive = true;
    setUrl('');
    setError('');
    if (file)
      fileUrl(file.id)
        .then((u) => {
          if (alive) setUrl(u);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [file?.id]);
  if (!file) return <p className="small muted">Không có tệp lời giải đính kèm.</p>;
  return (
    <div className="stack">
      <div className="row">
        {files.map((f, i) => (
          <button
            className={'button compact ' + (f.id === file.id ? 'primary' : '')}
            key={f.id}
            onClick={() => setSelected(f.id)}
          >
            Tệp {i + 1}
          </button>
        ))}
        <FileLink id={file.id} name="Mở tệp" />
      </div>
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {url &&
        (file.mime_type === 'application/pdf' ? (
          <iframe
            src={url}
            title={'Lời giải ' + file.name}
            style={{
              width: '100%',
              height: '70dvh',
              border: '1px solid var(--line)',
              borderRadius: 8,
            }}
          />
        ) : (
          <img
            src={url}
            alt={'Lời giải ' + file.name}
            style={{
              width: '100%',
              height: 'auto',
              border: '1px solid var(--line)',
              borderRadius: 8,
            }}
          />
        ))}
    </div>
  );
}
