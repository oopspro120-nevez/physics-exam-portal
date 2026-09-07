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
export async function overview(
  include: ('classes' | 'profiles' | 'members' | 'exams' | 'sessions')[] = [
    'classes',
    'profiles',
    'members',
    'exams',
    'sessions',
  ],
  classId?: string,
) {
  const { db, profile } = await authContext();
  const [classes, profiles, members, exams, sessions] = await Promise.all([
    include.includes('classes')
      ? readAll<Class>((a, b) =>
          db
            .from('classes')
            .select('*')
            .match(classId ? { id: classId } : {})
            .order('created_at', { ascending: false })
            .order('id')
            .range(a, b),
        )
      : Promise.resolve([] as Class[]),
    include.includes('profiles')
      ? readAll<Profile>((a, b) =>
          db
            .from('profiles')
            .select(classId ? '*,class_students!inner(class_id)' : '*')
            .match(classId ? { 'class_students.class_id': classId } : {})
            .order('full_name')
            .order('id')
            .range(a, b)
            .returns<Profile[]>(),
        )
      : Promise.resolve([] as Profile[]),
    include.includes('members')
      ? readAll<{ class_id: string; student_id: string }>((a, b) =>
          db
            .from('class_students')
            .select('class_id,student_id')
            .match(classId ? { class_id: classId } : {})
            .order('class_id')
            .order('student_id')
            .range(a, b),
        )
      : Promise.resolve([] as { class_id: string; student_id: string }[]),
    include.includes('exams')
      ? readAll<Exam>((a, b) =>
          db
            .from('exams')
            .select('*')
            .match(classId ? { class_id: classId } : {})
            .order('start_time', { ascending: false })
            .order('id')
            .range(a, b),
        )
      : Promise.resolve([] as Exam[]),
    include.includes('sessions')
      ? readAll<ExamSession>((a, b) => db.from('exam_sessions').select('*').order('id').range(a, b))
      : Promise.resolve([] as ExamSession[]),
  ]);
  return { profile, classes, profiles, members, exams, sessions };
}
export async function teacherExam(
  id: string,
  section: 'editor' | 'grading' | 'discussion' = 'grading',
) {
  const { db, profile } = await authContext();
  if (!['teacher', 'admin'].includes(profile.role)) throw new Error('FORBIDDEN');
  // For staff, exams RLS only exposes the classes they manage.
  const exam = checked(await db.from('exams').select('*').eq('id', id).single()) as Exam;
  const [problems, submissions, sessions, clarifications, announcements, files] = await Promise.all(
    [
      readAll<Problem>((a, b) =>
        db.from('problems').select('*').eq('exam_id', id).order('problem_number').range(a, b),
      ),
      section === 'grading'
        ? readAll<Submission>((a, b) =>
            db
              .from('submissions')
              .select('*')
              .eq('exam_id', id)
              .order('submitted_at')
              .order('id')
              .range(a, b),
          )
        : Promise.resolve([] as Submission[]),
      section === 'grading'
        ? readAll<ExamSession>((a, b) =>
            db.from('exam_sessions').select('*').eq('exam_id', id).order('id').range(a, b),
          )
        : Promise.resolve([] as ExamSession[]),
      section === 'discussion'
        ? readAll<Clarification>((a, b) =>
            db
              .from('clarifications')
              .select('*')
              .eq('exam_id', id)
              .order('created_at', { ascending: false })
              .order('id')
              .range(a, b),
          )
        : Promise.resolve([] as Clarification[]),
      section === 'discussion'
        ? readAll<Announcement>((a, b) =>
            db
              .from('announcements')
              .select('*')
              .eq('exam_id', id)
              .order('created_at', { ascending: false })
              .order('id')
              .range(a, b),
          )
        : Promise.resolve([] as Announcement[]),
      section !== 'discussion'
        ? readAll<Asset>((a, b) =>
            db
              .from('file_assets')
              .select('*')
              .eq('exam_id', id)
              .in(
                'bucket',
                section === 'editor'
                  ? ['exams', 'solutions']
                  : ['exams', 'solutions', 'submissions'],
              )
              .order('id')
              .range(a, b),
          )
        : Promise.resolve([] as Asset[]),
    ],
  );
  const keys =
    problems.length && section !== 'discussion'
      ? await readAll<AnswerKey>((a, b) =>
          db
            .from('problem_keys')
            .select('*,problems!inner(exam_id)')
            .eq('problems.exam_id', id)
            .order('problem_id')
            .range(a, b),
        )
      : [];
  // Join với submissions lọc đúng kỳ thi, tránh URL chứa hàng nghìn UUID.
  const attachments =
    section === 'grading'
      ? await readAll<{ submission_id: string; file_id: string; sort_order: number }>((a, b) =>
          db
            .from('submission_files')
            .select('submission_id,file_id,sort_order,submissions!inner(exam_id)')
            .eq('submissions.exam_id', id)
            .order('submission_id')
            .order('sort_order')
            .range(a, b),
        )
      : [];
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
