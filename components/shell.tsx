'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Atom,
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import type { Profile } from '@/types/domain';
import { useState } from 'react';
import { SessionGuard, type PortalSession } from '@/components/session-guard';
const roleNames = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh' };
export function Shell({
  profile,
  session,
  children,
}: {
  profile: Profile;
  session: PortalSession;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [error, setError] = useState('');
  const base = '/' + profile.role;
  const nav =
    profile.role === 'admin'
      ? [
          ['', 'Tổng quan', LayoutDashboard],
          ['/teachers', 'Giáo viên', GraduationCap],
          ['/classes', 'Lớp học', BookOpen],
          ['/users', 'Tài khoản', Users],
        ]
      : profile.role === 'teacher'
        ? [
            ['', 'Tổng quan', LayoutDashboard],
            ['/classes', 'Lớp phụ trách', BookOpen],
            ['/exams', 'Kỳ thi', FileText],
          ]
        : [
            ['', 'Tổng quan', LayoutDashboard],
            ['/exams', 'Kỳ thi của tôi', FileText],
          ];
  const links = nav.map(([suffix, label, Icon]) => {
    const href = base + suffix;
    const active = suffix ? path.startsWith(href) : path === href;
    const I = Icon as typeof Atom;
    return (
      <Link
        prefetch={false}
        className={'nav-link ' + (active ? 'active' : '')}
        href={href}
        key={href}
      >
        <I size={19} />
        {label as string}
      </Link>
    );
  });
  async function logout() {
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error();
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('portal-session-' + session.session_id);
        channel.postMessage({ type: 'logout' });
        channel.close();
      }
      window.location.assign('/login');
    } catch {
      setError('Không thể đăng xuất. Vui lòng thử lại.');
    }
  }
  return (
    <div className="app-shell">
      <SessionGuard session={session} />
      <aside className="sidebar">
        <Link prefetch={false} className="brand" href={base}>
          <span className="brand-icon">
            <Atom size={24} />
          </span>
          <span>
            PHYSICS<span className="brand-sub">EXAM PORTAL</span>
          </span>
        </Link>
        <p className="side-role">{roleNames[profile.role].toUpperCase()}</p>
        <nav>{links}</nav>
        <div className="sidebar-bottom">
          <p className="user-name">{profile.full_name}</p>
          <span className="user-role">@{profile.username}</span>
          <button
            className="nav-link full"
            style={{ border: 0, background: 'transparent', marginTop: 12 }}
            onClick={logout}
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
          {error && <small role="alert">{error}</small>}
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <span className="topbar-label">
            <ShieldCheck size={18} className="muted" />
            {roleNames[profile.role]}
          </span>
          <div className="row">
            <span className="small">{profile.full_name}</span>
            <span className="avatar">{profile.full_name.slice(0, 1)}</span>
            <button className="icon-button" aria-label="Đăng xuất" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <nav className="mobile-nav">{links}</nav>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
