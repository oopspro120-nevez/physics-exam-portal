'use client';
import { useEffect, useRef, useState } from 'react';
import type { Draft } from '@/types/domain';
export async function contestPost(body: Record<string, unknown>) {
  const r = await fetch('/api/contest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
type LocalDraft = { answer: string; unit: string; revision: number; dirty: boolean };
export function useDraft(
  key: string,
  problemId: string,
  initial: Draft | undefined,
  enabled: boolean,
) {
  const [value, setValue] = useState<LocalDraft>({
    answer: initial?.answer || '',
    unit: initial?.unit || '',
    revision: initial?.revision || 0,
    dirty: false,
  });
  const current = useRef(value);
  const [loaded, setLoaded] = useState(false),
    [status, setStatus] = useState('Đã đồng bộ'),
    [conflict, setConflict] = useState<Draft | null>(null);
  const saving = useRef(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let saved: LocalDraft | undefined;
    try {
      const raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {
      setStatus('Trình duyệt không cho phép lưu bản nháp cục bộ.');
    }
    const next = saved?.dirty
      ? saved
      : {
          answer: initial?.answer || '',
          unit: initial?.unit || '',
          revision: initial?.revision || 0,
          dirty: false,
        };
    current.current = next;
    setValue(next);
    setLoaded(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [key]);
  function persist(next: LocalDraft) {
    current.current = next;
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStatus('Không lưu được trên trình duyệt. Hãy giữ trang mở.');
    }
  }
  function edit(field: 'answer' | 'unit', v: string) {
    persist({ ...current.current, [field]: v, dirty: true });
    setStatus('Đã lưu trên thiết bị');
  }
  useEffect(() => {
    if (!loaded || !value.dirty || !online || !enabled || conflict) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (saving.current) return;
      saving.current = true;
      const snapshot = { ...current.current };
      try {
        const d = await contestPost({
          action: 'draft',
          problem_id: problemId,
          answer: snapshot.answer,
          unit: snapshot.unit,
          revision: snapshot.revision,
        });
        if (d.conflict) {
          setConflict(d.draft);
          setStatus('Có bản nháp mới ở tab khác.');
        } else {
          const same =
            current.current.answer === snapshot.answer && current.current.unit === snapshot.unit;
          persist({ ...current.current, revision: d.draft.revision, dirty: !same });
          setStatus(same ? 'Đã đồng bộ' : 'Đã lưu trên thiết bị');
        }
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : 'Chờ kết nối để đồng bộ');
      } finally {
        saving.current = false;
      }
    }, 900);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [value, loaded, online, enabled, conflict, problemId]);
  // Retry after transient failures even when the student stops typing.
  useEffect(() => {
    const interval = setInterval(() => {
      if (current.current.dirty && !saving.current) setValue({ ...current.current });
    }, 8000);
    return () => clearInterval(interval);
  }, []);
  function resolve(useServer: boolean) {
    if (!conflict) return;
    persist({
      answer: useServer ? conflict.answer : current.current.answer,
      unit: useServer ? conflict.unit : current.current.unit,
      revision: conflict.revision,
      dirty: !useServer,
    });
    setConflict(null);
    setStatus(useServer ? 'Đã dùng bản trên máy chủ' : 'Đang đồng bộ bản trên thiết bị');
  }
  return {
    answer: value.answer,
    unit: value.unit,
    edit,
    status,
    online,
    loaded,
    conflict,
    resolve,
  };
}
