import 'server-only';
import { authContext } from '@/lib/auth';
import { checked } from '@/lib/http';
import { readAll } from './pagination';
import type {
  Class,
  Exam,
  Profile,
  Problem,
  Submission,
  ExamSession,
  Clarification,
  Announcement,
  AnswerKey,
  Asset,
} from '@/types/domain';
export async function overview() {
  const { db, profile } = await authContext();
  const [classes, profiles, members, exams, sessions] = await Promise.all([
    readAll<Class>((a, b) =>
      db
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(a, b),
    ),
    readAll<Profile>((a, b) =>
      db.from('profiles').select('*').order('full_name').order('id').range(a, b),
    ),
    readAll<{ class_id: string; student_id: string }>((a, b) =>
      db.from('class_students').select('*').order('class_id').order('student_id').range(a, b),
    ),
    readAll<Exam>((a, b) =>
      db
        .from('exams')
        .select('*')
        .order('start_time', { ascending: false })
        .order('id')
        .range(a, b),
    ),
    readAll<ExamSession>((a, b) => db.from('exam_sessions').select('*').order('id').range(a, b)),
  ]);
  return { profile, classes, profiles, members, exams, sessions };
}
export async function teacherExam(id: string) {
  const { db } = await authContext();
  if (!checked(await db.rpc('manages_exam', { eid: id }))) throw new Error('FORBIDDEN');
  const exam = checked(await db.from('exams').select('*').eq('id', id).single()) as Exam;
  const [problems, submissions, sessions, clarifications, announcements, files] = await Promise.all(
    [
      readAll<Problem>((a, b) =>
        db.from('problems').select('*').eq('exam_id', id).order('problem_number').range(a, b),
      ),
      readAll<Submission>((a, b) =>
        db
          .from('submissions')
          .select('*')
          .eq('exam_id', id)
          .order('submitted_at')
          .order('id')
          .range(a, b),
      ),
      readAll<ExamSession>((a, b) =>
        db.from('exam_sessions').select('*').eq('exam_id', id).order('id').range(a, b),
      ),
      readAll<Clarification>((a, b) =>
        db
          .from('clarifications')
          .select('*')
          .eq('exam_id', id)
          .order('created_at', { ascending: false })
          .order('id')
          .range(a, b),
      ),
      readAll<Announcement>((a, b) =>
        db
          .from('announcements')
          .select('*')
          .eq('exam_id', id)
          .order('created_at', { ascending: false })
          .order('id')
          .range(a, b),
      ),
      readAll<Asset>((a, b) =>
        db.from('file_assets').select('*').eq('exam_id', id).order('id').range(a, b),
      ),
    ],
  );
  const keys = problems.length
    ? await readAll<AnswerKey>((a, b) =>
        db
          .from('problem_keys')
          .select('*')
          .in(
            'problem_id',
            problems.map((p) => p.id),
          )
          .order('problem_id')
          .range(a, b),
      )
    : [];
  // Join với submissions lọc đúng kỳ thi, tránh URL chứa hàng nghìn UUID.
  const attachments = await readAll<{ submission_id: string; file_id: string; sort_order: number }>(
    (a, b) =>
      db
        .from('submission_files')
        .select('submission_id,file_id,sort_order,submissions!inner(exam_id)')
        .eq('submissions.exam_id', id)
        .order('submission_id')
        .order('sort_order')
        .range(a, b),
  );
  return {
    exam,
    problems,
    submissions,
    sessions,
    clarifications,
    announcements,
    keys,
    files,
    attachments,
  };
}
