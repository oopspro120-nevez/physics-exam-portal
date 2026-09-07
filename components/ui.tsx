import { FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';
export function PageHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">PHYSICS EXAM PORTAL</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = 'Chưa có dữ liệu',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={30} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="section-gap">{action}</div>}
    </div>
  );
}
export function Badge({ children, color = '' }: { children: ReactNode; color?: string }) {
  return <span className={'badge ' + color}>{children}</span>;
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number | string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {icon}
      </div>
      <div className="stat-value mono">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
export const fmt = (date: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(date));
