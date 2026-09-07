'use client';
import { useEffect, useRef, useState } from 'react';
import { activityAge, IDLE_WARNING_MS } from '@/lib/session';
export type PortalSession = { session_id: string; expires_at: string; server_time: string };
let documentTabId: string | undefined;
export function SessionGuard({ session }: { session: PortalSession }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const renew = useRef<() => void>(() => {});
  useEffect(() => {
    // A fresh ID per document handles a delayed pagehide arriving after a reload opens.
    const tabId = (documentTabId ||= crypto.randomUUID());
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('portal-session-' + session.session_id)
        : null;
    let expiry = Date.now() + Date.parse(session.expires_at) - Date.parse(session.server_time);
    let lastActivity: number | null = null;
    let lastSent = 0,
      busy = false,
      ended = false,
      disposed = false;
    async function endSession() {
      if (ended || disposed) return;
      ended = true;
      channel?.postMessage({ type: 'logout' });
      // RLS already rejects expired sessions even when this best-effort cleanup fails.
      try {
        await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(3000) });
      } catch {
        /* Keep local answer drafts; login will clean stale device bindings. */
      }
      window.location.replace('/login?reason=expired');
    }
    async function sync(op: 'open' | 'heartbeat' = 'heartbeat') {
      if (busy || ended || disposed) return;
      busy = true;
      lastSent = Date.now();
      try {
        const r = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op,
            tab_id: tabId,
            activity_age_ms: activityAge(lastActivity, Date.now()),
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (r.status === 401 || r.status === 403) {
          void endSession();
          return;
        }
        if (!r.ok) throw new Error('Session unavailable');
        const d = await r.json();
        if (disposed || ended) return;
        expiry = Date.now() + Date.parse(d.expires_at) - Date.parse(d.server_time);
        channel?.postMessage({ type: 'expiry', expiry });
      } catch {
        if (Date.now() >= expiry) void endSession();
      } finally {
        busy = false;
      }
    }
    const activity = (event?: Event) => {
      if (event && !event.isTrusted) return;
      if (Date.now() >= expiry) {
        void sync();
        return;
      }
      lastActivity = Date.now();
      // At most four activity writes per minute, plus a minute-level presence check.
      if (Date.now() - lastSent >= 15000 || expiry - Date.now() < IDLE_WARNING_MS) void sync();
    };
    renew.current = () => activity();
    if (channel)
      channel.onmessage = ({ data }) => {
        if (data?.type === 'logout') {
          ended = true;
          window.location.replace('/login?reason=expired');
        } else if (data?.type === 'expiry' && Number.isFinite(data.expiry))
          expiry = Math.max(expiry, data.expiry);
      };
    const visible = () => {
      if (document.visibilityState === 'visible') void sync('open');
    };
    const close = () => {
      const body = new Blob([JSON.stringify({ op: 'close', tab_id: tabId })], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/auth/session', body);
    };
    const events = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'] as const;
    events.forEach((name) =>
      window.addEventListener(name, activity, { passive: true, capture: true }),
    );
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    window.addEventListener('pageshow', visible);
    window.addEventListener('pagehide', close);
    void sync('open');
    const timer = setInterval(() => {
      const left = Math.max(0, expiry - Date.now());
      setRemaining(left <= IDLE_WARNING_MS ? Math.ceil(left / 1000) : null);
      if (!left || (document.visibilityState === 'visible' && Date.now() - lastSent >= 60000))
        void sync();
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
      channel?.close();
      events.forEach((name) => window.removeEventListener(name, activity, true));
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', visible);
      window.removeEventListener('pageshow', visible);
      window.removeEventListener('pagehide', close);
    };
  }, [session.session_id]);
  if (remaining === null) return null;
  return (
    <aside className="session-warning" aria-label="Phiên đăng nhập sắp hết hạn">
      <div>
        <strong>Phiên đăng nhập sắp kết thúc</strong>
        <p>Còn {remaining} giây. Chọn tiếp tục nếu bạn vẫn đang làm việc.</p>
      </div>
      <button className="button primary" onClick={() => renew.current()}>
        Tiếp tục làm việc
      </button>
    </aside>
  );
}
