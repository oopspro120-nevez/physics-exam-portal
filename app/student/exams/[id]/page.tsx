import { getContest } from '@/services/student';
import { Contest } from '@/components/contest/contest';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, studentId } = await getContest(id);
  return <Contest initial={data} studentId={studentId} />;
}
