'use client';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
export function LoginForm({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [show, setShow] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const data = new FormData(e.currentTarget);
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: data.get('username'),
              password: data.get('password'),
              device_id: crypto.randomUUID(),
            }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error);
          window.location.assign(d.redirect);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Không thể kết nối.');
        } finally {
          setBusy(false);
        }
      }}
      className="stack"
    >
      <label>
        Tên đăng nhập
        <input
          name="username"
          autoComplete="username"
          required
          placeholder="Tên đăng nhập được cấp"
          disabled={!configured}
        />
      </label>
      <label>
        Mật khẩu
        <div className="password-field">
          <input
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Nhập mật khẩu"
            disabled={!configured}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
      {!configured && (
        <p className="notice">
          Cổng thi đang chờ quản trị viên kết nối hệ thống. Vui lòng quay lại sau.
        </p>
      )}
      <button disabled={busy || !configured} className="button primary full" type="submit">
        {busy ? (
          <Loader2 size={18} className="spin" />
        ) : (
          <>
            Đăng nhập <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="muted small login-help">
        <LockKeyhole size={15} /> Tài khoản do nhà trường cấp. Quên mật khẩu? Liên hệ giáo viên phụ
        trách.
      </p>
    </form>
  );
}
