'use client';
import { useEffect, useRef, useState } from 'react';
import {
  activityAge,
  IDLE_WARNING_MS,
  OFFLINE_TIMEOUT_MS,
  PRESENCE_HEARTBEAT_MS,
} from '@/lib/session';

export type PortalSession = { session_id: string; expires_at: string; server_time: string };
let documentTabId: string | undefined;

export function SessionGuard({ session }: { session: PortalSession }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [offlineRemaining, setOfflineRemaining] = useState<number | null>(null);
  const renew = useRef<() => void>(() => {});

  useEffect(() => {
    const tabId = (documentTabId ||= crypto.randomUUID());
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('portal-session-' + session.session_id)
        : null;

    let expiry = Date.now() + Date.parse(session.expires_at) - Date.parse(session.server_time);
    let lastActivity: number | null = null;
    let lastSent = 0;
    let busy = false;
    let ended = false;
    let disposed = false;
    let offlineSince: number | null = navigator.onLine ? null : Date.now();
    let offlineExpired = false;

    async function serverLogoutAndRedirect(reason: 'expired' | 'offline') {
      channel?.postMessage({ type: 'logout', reason });
      if (navigator.onLine) {
        try {
          await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(3000) });
        } catch {
          /* Presence expiry/device takeover still invalidates the stale binding. */
        }
      }
      window.location.replace('/login?reason=' + reason);
    }

    async function expireSession(reason: 'expired' | 'offline' = 'expired') {
      if (ended || disposed) return;
      ended = true;
      if (reason === 'offline' && !navigator.onLine) {
        offlineExpired = true;
        setOfflineRemaining(0);
        channel?.postMessage({ type: 'logout', reason: 'offline' });
        return;
      }
      await serverLogoutAndRedirect(reason);
    }

    async function sync(op: 'open' | 'heartbeat' = 'heartbeat') {
      if (busy || ended || disposed || !navigator.onLine) return;
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
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 401 || r.status === 403) {
          await expireSession('expired');
          return;
        }
        if (!r.ok) throw new Error('Session unavailable');
        const d = await r.json();
        if (disposed || ended) return;
        expiry = Date.now() + Date.parse(d.expires_at) - Date.parse(d.server_time);
        channel?.postMessage({ type: 'expiry', expiry });
      } catch {
        if (Date.now() >= expiry) void expireSession('expired');
      } finally {
        busy = false;
      }
    }

    const activity = (event?: Event) => {
      if (event && !event.isTrusted) return;
      lastActivity = Date.now();
      if (expiry - Date.now() < IDLE_WARNING_MS) void sync();
    };
    renew.current = () => activity();

    if (channel)
      channel.onmessage = ({ data }) => {
        if (data?.type === 'logout') {
          ended = true;
          if (data.reason === 'offline' && !navigator.onLine) {
            offlineExpired = true;
            setOfflineRemaining(0);
          } else {
            window.location.replace('/login?reason=' + (data.reason === 'offline' ? 'offline' : 'expired'));
          }
        } else if (data?.type === 'expiry' && Number.isFinite(data.expiry)) {
          expiry = Math.max(expiry, data.expiry);
        }
      };

    const handleOffline = () => {
      offlineSince ??= Date.now();
      setOfflineRemaining(Math.ceil(OFFLINE_TIMEOUT_MS / 1000));
    };

    const handleOnline = () => {
      const wasOfflineFor = offlineSince === null ? 0 : Date.now() - offlineSince;
      if (offlineExpired || wasOfflineFor >= OFFLINE_TIMEOUT_MS) {
        ended = true;
        void serverLogoutAndRedirect('offline');
        return;
      }
      offlineSince = null;
      setOfflineRemaining(null);
      void sync('open');
    };

    const visible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !ended) void sync('open');
    };

    const close = () => {
      if (!navigator.onLine || ended) return;
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
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pageshow', visible);
    window.addEventListener('pagehide', close);

    if (offlineSince !== null) handleOffline();
    else void sync('open');

    const timer = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, expiry - now);
      setRemaining(left <= IDLE_WARNING_MS ? Math.ceil(left / 1000) : null);
      if (!left) void expireSession('expired');

      if (offlineSince !== null) {
        const offlineLeft = Math.max(0, OFFLINE_TIMEOUT_MS - (now - offlineSince));
        setOfflineRemaining(Math.ceil(offlineLeft / 1000));
        if (!offlineLeft && !offlineExpired) void expireSession('offline');
      } else if (navigator.onLine && !ended && now - lastSent >= PRESENCE_HEARTBEAT_MS) {
        void sync();
      }
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(timer);
      channel?.close();
      events.forEach((name) => window.removeEventListener(name, activity, true));
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pageshow', visible);
      window.removeEventListener('pagehide', close);
    };
  }, [session.session_id]);

  if (offlineRemaining !== null) {
    return (
      <aside className="session-warning" aria-label="Mất kết nối mạng">
        <div>
          <strong>Mất kết nối mạng</strong>
          <p>
            {offlineRemaining > 0
              ? `Phiên sẽ kết thúc sau ${offlineRemaining} giây nếu mạng chưa trở lại.`
              : 'Phiên đã hết hiệu lực. Khi có mạng lại, vui lòng đăng nhập lại.'}
          </p>
        </div>
      </aside>
    );
  }

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
