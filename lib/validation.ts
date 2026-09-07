import { z } from 'zod';
const id = z.uuid();
const optionalId = z.union([id, z.literal('')]).optional();
const bool = z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean());
const baseExam = {
  id: optionalId,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).default(''),
  class_id: id,
  start_time: z.iso.datetime({ offset: true }),
  end_time: z.iso.datetime({ offset: true }),
  duration: z.coerce.number().int().min(1).max(1440),
  scoring_mode: z.enum(['PRACTICE', 'CHALLENGE', 'EXAM']),
  allow_late_submission: bool,
  attempt_weights: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map(Number) : v),
    z.array(z.number().min(0).max(1)).min(1).max(10),
  ),
};
export const schemas = {
  class_save: z.object({
    id: optionalId,
    name: z.string().trim().min(1).max(150),
    teacher_id: optionalId,
  }),
  enroll: z.object({ class_id: id, student_id: id }),
  lock_user: z.object({ id, active: bool }),
  reset_device: z.object({ id }),
  exam_save: z
    .object(baseExam)
    .refine(
      (v) => Date.parse(v.end_time) > Date.parse(v.start_time),
      'Thời gian kết thúc phải sau thời gian mở.',
    ),
  problem_save: z
    .object({
      id: optionalId,
      exam_id: id,
      problem_number: z.coerce.number().int().positive(),
      title: z.string().max(200).default(''),
      answer_type: z.enum(['numeric', 'text', 'essay', 'file_only']),
      correct_answer: z.string().max(1000).default(''),
      unit: z.string().max(80).default(''),
      tolerance_type: z.enum(['absolute', 'relative']),
      tolerance_value: z.coerce.number().min(0),
      max_attempts: z.preprocess(
        (v) => (v === '' || v === null ? null : Number(v)),
        z.number().int().min(1).max(100).nullable(),
      ),
      points: z.coerce.number().positive().max(10000),
      auto_points: z.coerce.number().min(0).max(10000),
      require_solution: bool,
    })
    .refine((v) => v.auto_points <= v.points, 'Điểm tự động không được vượt tổng điểm.')
    .refine(
      (v) => !['essay', 'file_only'].includes(v.answer_type) || v.auto_points === 0,
      'Bài tự luận có điểm tự động bằng 0.',
    ),
  problem_delete: z.object({ id }),
  exam_publish: z.object({ id }),
  exam_close: z.object({ id }),
  publish_result: z.object({ id, publish: bool }),
  grade: z.object({
    id,
    manual_score: z.coerce.number().min(0).max(10000),
    comment: z.string().max(4000).default(''),
  }),
  announce: z.object({ exam_id: id, content: z.string().trim().min(1).max(4000) }),
  reply: z.object({ id, answer: z.string().trim().min(1).max(4000), publish: bool }),
};
export const createUsersSchema = z.object({
  role: z.enum(['teacher', 'student']),
  class_id: id.optional(),
  users: z
    .array(
      z.object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9._-]{3,40}$/,
            'Tên đăng nhập: 3–40 ký tự a-z, 0-9, dấu chấm, gạch ngang hoặc gạch dưới.',
          ),
        full_name: z.string().trim().min(1).max(150),
        password: z.string().min(10, 'Mật khẩu cần ít nhất 10 ký tự.').max(128),
      }),
    )
    .min(1)
    .max(20),
});
