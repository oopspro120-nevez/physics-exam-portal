import 'server-only';
import { authContext } from '@/lib/auth';
import { checked } from '@/lib/http';
import type { ContestData } from '@/types/domain';
export async function getContest(id: string) {
  const { db, profile } = await authContext();
  if (profile.role !== 'student') throw new Error('FORBIDDEN');
  return {
    data: checked(await db.rpc('contest_data', { eid: id })) as ContestData,
    studentId: profile.id,
  };
}
export async function getProgress() {
  const { db } = await authContext();
  return checked(await db.rpc('my_progress')) as {
    exam_id: string;
    total: number;
    completed: number;
  }[];
}
