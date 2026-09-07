'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActionButton } from '@/components/mutations';
const EditorContext = createContext(false);
export function EditorState({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = root.current!;
    const dirty = new Set<HTMLFormElement>();
    const uploading = new Set<string>();
    const update = () => {
      for (const form of dirty) if (!form.isConnected) dirty.delete(form);
      setBlocked(dirty.size > 0 || uploading.size > 0);
    };
    const change = (e: Event) => {
      const form = (e.target as HTMLElement).closest('form');
      if (form) dirty.add(form);
      update();
    };
    const saved = (e: Event) => {
      dirty.delete(e.target as HTMLFormElement);
      update();
    };
    const upload = (e: Event) => {
      const { id, busy } = (e as CustomEvent).detail;
      if (busy) uploading.add(id);
      else uploading.delete(id);
      update();
    };
    element.addEventListener('input', change);
    element.addEventListener('change', change);
    element.addEventListener('portal-form-saved', saved);
    window.addEventListener('portal-upload-state', upload);
    const observer = new MutationObserver(update);
    observer.observe(element, { childList: true, subtree: true });
    return () => {
      element.removeEventListener('input', change);
      element.removeEventListener('change', change);
      element.removeEventListener('portal-form-saved', saved);
      window.removeEventListener('portal-upload-state', upload);
      observer.disconnect();
    };
  }, []);
  return (
    <EditorContext.Provider value={blocked}>
      <div ref={root}>{children}</div>
    </EditorContext.Provider>
  );
}
export function PublishExam({
  id,
  ready,
  confirmation,
}: {
  id: string;
  ready: boolean;
  confirmation: string;
}) {
  const blocked = useContext(EditorContext);
  return (
    <div className="stack">
      {blocked && (
        <p className="notice" role="status">
          Hãy lưu nội dung đang sửa và chờ tệp tải xong trước khi giao đề.
        </p>
      )}
      <ActionButton
        action="exam_publish"
        payload={{ id }}
        disabled={!ready || blocked}
        confirmation={confirmation}
      >
        Giao đề cho lớp
      </ActionButton>
    </div>
  );
}
