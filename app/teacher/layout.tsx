import { requireRole } from '@/lib/auth';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { profile, session } = await requireRole(['teacher']);
  return (
    <Shell profile={profile} session={session}>
      {children}
    </Shell>
  );
}
