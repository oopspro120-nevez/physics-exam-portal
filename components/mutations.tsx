'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
export async function mutate(action: string, payload: Record<string, unknown>) {
  const r = await fetch('/api/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export function ManagedForm({
  action,
  payload = {},
  children,
  label = 'Lưu thay đổi',
  navigatePrefix,
  reset = false,
}: {
  action: string;
  payload?: Record<string, unknown>;
  children: React.ReactNode;
  label?: string;
  navigatePrefix?: string;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  const router = useRouter();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setMessage('');
        try {
          const data = { ...payload, ...Object.fromEntries(new FormData(form)) };
          for (const k of ['start_time', 'end_time'])
            if (data[k]) data[k] = new Date(String(data[k])).toISOString();
          const d = await mutate(action, data);
          setError(false);
          setMessage('Đã lưu thành công.');
          if (reset) form.reset();
          if (navigatePrefix && d.id) router.push(navigatePrefix + d.id);
          router.refresh();
        } catch (e) {
          setError(true);
          setMessage(e instanceof Error ? e.message : 'Không thể lưu dữ liệu.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {message && (
        <div role="status" className={'notice ' + (error ? 'danger' : 'success')}>
          {message}
        </div>
      )}
      <div>
        <button className="button primary" disabled={busy}>
          {busy && <Loader2 size={16} className="spin" />}
          {label}
        </button>
      </div>
    </form>
  );
}
export function ActionButton({
  action,
  payload,
  children,
  danger = false,
  confirmation,
}: {
  action: string;
  payload: Record<string, unknown>;
  children: React.ReactNode;
  danger?: boolean;
  confirmation?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  return (
    <span>
      <button
        type="button"
        className={'button compact ' + (danger ? 'danger' : '')}
        disabled={busy}
        onClick={async () => {
          if (confirmation && !window.confirm(confirmation)) return;
          setBusy(true);
          setError('');
          try {
            await mutate(action, payload);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={15} className="spin" /> : children}
      </button>
      {error && (
        <span role="alert" className="small" style={{ display: 'block', color: 'var(--red)' }}>
          {error}
        </span>
      )}
    </span>
  );
}
export function PasswordReset({ id }: { id: string }) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <span>
      <button
        className="button compact"
        disabled={busy}
        onClick={async () => {
          const password = window.prompt(
            'Nhập mật khẩu mới (ít nhất 10 ký tự). Các phiên đăng nhập cũ sẽ bị thu hồi.',
          );
          if (!password) return;
          setBusy(true);
          try {
            const r = await fetch('/api/users', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, password }),
            });
            const d = await r.json();
            setMessage(r.ok ? 'Đã đổi mật khẩu và thu hồi thiết bị cũ.' : d.error);
          } catch {
            setMessage('Không thể kết nối.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Đặt lại mật khẩu
      </button>
      {message && (
        <span role="status" className="small" style={{ display: 'block' }}>
          {message}
        </span>
      )}
    </span>
  );
}
