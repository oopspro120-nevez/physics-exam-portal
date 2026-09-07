-- Physics Exam Portal. Chạy các migration theo thứ tự, bằng SQL Editor/service role.
create schema if not exists private;
revoke all on schema private from public;
create type public.app_role as enum ('admin','teacher','student');
create type public.answer_kind as enum ('numeric','text','essay','file_only');
create type public.problem_status as enum ('UNSOLVED','ATTEMPTED','SOLVED','SUBMITTED','REVIEWED');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9._-]{3,40}$'),
 full_name text not null check(length(full_name) between 1 and 150),
 role public.app_role not null, created_by uuid references public.profiles(id) on delete set null, active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.classes (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 150),
 teacher_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index classes_teacher_idx on public.classes(teacher_id);
create table public.class_students (
 class_id uuid references public.classes(id) on delete cascade,
 student_id uuid references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(class_id,student_id)
);
create index class_students_student_idx on public.class_students(student_id);
create table public.user_devices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 device_id text not null, -- SHA-256 của token ngẫu nhiên, không phải ID phần cứng.
 browser_info text, first_registered_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(), active boolean not null default true
);
create unique index one_active_device on public.user_devices(user_id) where active;
create table private.device_sessions (
 session_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 device_id uuid not null references public.user_devices(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index device_sessions_user_idx on private.device_sessions(user_id);
create table public.exams (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200),
 description text not null default '', class_id uuid not null references public.classes(id),
 teacher_id uuid not null references public.profiles(id), pdf_path text,
 start_time timestamptz not null, end_time timestamptz not null,
 duration integer not null check(duration between 1 and 1440),
 status text not null default 'draft' check(status in ('draft','published','closed')),
 scoring_mode text not null default 'PRACTICE' check(scoring_mode in ('PRACTICE','CHALLENGE','EXAM')),
 attempt_weights numeric[] not null default array[1,0.8,0.6]::numeric[],
 allow_late_submission boolean not null default false, publish_result boolean not null default false,
 created_at timestamptz not null default now(), check(end_time > start_time),
 check(cardinality(attempt_weights) between 1 and 10 and 0 <= all(attempt_weights) and 1 >= all(attempt_weights))
);
create index exams_class_time_idx on public.exams(class_id,start_time);
create table public.problems (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
 problem_number integer not null check(problem_number > 0), title text not null default '',
 answer_type public.answer_kind not null, unit text not null default '',
 max_attempts integer check(max_attempts between 1 and 100), -- NULL = unlimited.
 points numeric(10,3) not null check(points > 0),
 auto_points numeric(10,3) not null default 0 check(auto_points >= 0),
 require_solution boolean not null default false,
 unique(exam_id,problem_number), unique(id,exam_id), check(auto_points <= points),
 check(answer_type not in ('essay','file_only') or auto_points=0)
);
-- Đáp án và dung sai nằm riêng: RLS không thể che một cột trong hàng được phép SELECT.
create table public.problem_keys (
 problem_id uuid primary key references public.problems(id) on delete cascade,
 correct_answer text, tolerance_type text not null default 'absolute' check(tolerance_type in ('absolute','relative')),
 tolerance_value numeric not null default 0 check(tolerance_value >= 0), solution_path text
);
create table public.exam_sessions (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
 student_id uuid not null references public.profiles(id), started_at timestamptz not null default now(),
 deadline timestamptz not null, finished_at timestamptz, unique(exam_id,student_id)
);
create index exam_sessions_student_idx on public.exam_sessions(student_id);
create table public.answer_drafts (
 problem_id uuid references public.problems(id) on delete cascade,
 student_id uuid references public.profiles(id) on delete cascade,
 answer text not null default '' check(length(answer)<=20000), unit text not null default '',
 revision bigint not null default 0, updated_at timestamptz not null default now(),
 primary key(problem_id,student_id)
);
create table public.file_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 exam_id uuid not null references public.exams(id), problem_id uuid references public.problems(id),
 bucket text not null check(bucket in ('exams','submissions','solutions')), path text not null unique,
 name text not null, mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 26214400),
 ready boolean not null default false, created_at timestamptz not null default now()
);
create index file_assets_exam_idx on public.file_assets(exam_id,owner_id);
-- Mỗi lần nộp là một hàng mới. Không ghi đè đáp án hoặc lịch sử.
create table public.submissions (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
 problem_id uuid not null, student_id uuid not null references public.profiles(id),
 answer text not null default '', numeric_value numeric, unit text not null default '',
 attempt_number integer not null check(attempt_number > 0), solution_path text,
 status public.problem_status not null, is_correct boolean,
 auto_score numeric(10,3) not null default 0, manual_score numeric(10,3),
 final_score numeric(10,3) generated always as (auto_score+coalesce(manual_score,0)) stored,
 comment text not null default '', submitted_at timestamptz not null default now(),
 is_late boolean not null default false, request_id uuid not null,
 foreign key(problem_id,exam_id) references public.problems(id,exam_id),
 unique(problem_id,student_id,attempt_number), unique(student_id,request_id)
);
create index submissions_exam_student_idx on public.submissions(exam_id,student_id);
create table public.submission_attempts (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.submissions(id),
 created_at timestamptz not null default now()
); -- Lịch sử liên kết submissions, không sao chép answer/score sang bảng thứ hai.
create table public.submission_files (
 submission_id uuid references public.submissions(id), file_id uuid references public.file_assets(id),
 sort_order integer not null check(sort_order>=0), primary key(submission_id,file_id), unique(submission_id,sort_order)
);
create table public.clarifications (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
 problem_id uuid not null, student_id uuid not null references public.profiles(id),
 question text not null check(length(question) between 1 and 2000), answer text,
 replied_by uuid references public.profiles(id), replied_at timestamptz, created_at timestamptz not null default now(),
 foreign key(problem_id,exam_id) references public.problems(id,exam_id)
);
create index clarifications_exam_idx on public.clarifications(exam_id,created_at);
create table public.announcements (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
 author_id uuid not null references public.profiles(id), content text not null check(length(content) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index announcements_exam_idx on public.announcements(exam_id,created_at);
create table private.login_limits (key text primary key, window_at timestamptz not null default now(), count integer not null default 1);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
 action text not null, target_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
