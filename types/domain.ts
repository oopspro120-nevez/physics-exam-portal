export type Role = 'admin' | 'teacher' | 'student';
export type Status = 'UNSOLVED' | 'ATTEMPTED' | 'SOLVED' | 'SUBMITTED' | 'REVIEWED';
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}
export interface Class {
  id: string;
  name: string;
  teacher_id: string | null;
  created_at: string;
}
export interface Exam {
  id: string;
  title: string;
  description: string;
  class_id: string;
  teacher_id: string;
  pdf_path: string | null;
  start_time: string;
  end_time: string;
  duration: number;
  status: 'draft' | 'published' | 'closed';
  scoring_mode: 'PRACTICE' | 'CHALLENGE' | 'EXAM';
  attempt_weights: number[];
  allow_late_submission: boolean;
  publish_result: boolean;
  created_at: string;
}
export interface Problem {
  id: string;
  exam_id: string;
  problem_number: number;
  title: string;
  answer_type: 'numeric' | 'text' | 'essay' | 'file_only';
  unit: string;
  max_attempts: number | null;
  points: number;
  auto_points: number;
  require_solution: boolean;
}
export interface AnswerKey {
  problem_id: string;
  correct_answer: string | null;
  tolerance_type: 'absolute' | 'relative';
  tolerance_value: number;
  solution_path: string | null;
}
export interface Submission {
  score_multiplier: number;
  id: string;
  exam_id: string;
  problem_id: string;
  student_id: string;
  answer: string;
  unit: string;
  numeric_value: number | null;
  attempt_number: number;
  status: Status;
  auto_score: number | null;
  manual_score: number | null;
  final_score: number | null;
  comment: string | null;
  submitted_at: string;
  is_late: boolean;
  solution_path: string | null;
  is_correct: boolean | null;
}
export interface Asset {
  id: string;
  exam_id: string;
  problem_id: string | null;
  owner_id: string;
  bucket: 'exams' | 'submissions' | 'solutions';
  path: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  ready: boolean;
}
export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  deadline: string;
  finished_at: string | null;
}
export interface Clarification {
  id: string;
  exam_id: string;
  problem_id: string;
  student_id: string;
  question: string;
  answer: string | null;
  created_at: string;
  replied_at: string | null;
}
export interface Announcement {
  id: string;
  exam_id: string;
  content: string;
  created_at: string;
}
export interface Draft {
  problem_id: string;
  answer: string;
  unit: string;
  revision: number;
  updated_at: string;
}
export interface ContestData {
  attachments: { submission_id: string; file_id: string; sort_order: number }[];
  exam: Exam;
  problems: Problem[];
  session: ExamSession | null;
  submissions: Submission[];
  drafts: Draft[];
  files: Asset[];
  announcements: Announcement[];
  clarifications: Clarification[];
  server_time: string;
  keys?: AnswerKey[];
}
