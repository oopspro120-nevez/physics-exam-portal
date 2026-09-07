-- Hàm SECURITY DEFINER có search_path cố định; không nhận user_id từ trình duyệt để xác định người đang gọi.
create function public.current_role() returns public.app_role language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p where p.id=auth.uid() and p.active and exists (
 select 1 from private.device_sessions s join public.user_devices d on d.id=s.device_id
 where s.user_id=p.id and s.session_id=(auth.jwt()->>'session_id')::uuid and d.active)
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.current_role()='admin',false)$$;
create function public.manages_class(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(public.current_role()::text,'')='teacher' and exists(select 1 from public.classes where id=cid and teacher_id=auth.uid()))
$$;
create function public.in_class(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.manages_class(cid) or (coalesce(public.current_role()::text,'')='student' and exists(select 1 from public.class_students where class_id=cid and student_id=auth.uid()))
$$;
create function public.manages_exam(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.exams e where e.id=eid and public.manages_class(e.class_id))
$$;
create function public.sees_exam(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.exams e where e.id=eid and (public.manages_class(e.class_id) or (e.status<>'draft' and public.in_class(e.class_id))))
$$;
create function public.manages_student(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(public.current_role()::text,'')='teacher' and exists(select 1 from public.class_students cs where cs.student_id=sid and public.manages_class(cs.class_id)))
$$;
create function public.sees_file(fid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.file_assets f join public.exams e on e.id=f.exam_id where f.id=fid and (
 public.manages_exam(e.id) or (public.sees_exam(e.id) and (
 (f.bucket='submissions' and f.owner_id=auth.uid()) or
 (f.bucket='exams' and now()>=e.start_time) or
 (f.bucket='solutions' and e.publish_result and (e.status='closed' or now()>=e.end_time))))))
$$;
do $$ declare t text; begin
 foreach t in array array['profiles','classes','class_students','user_devices','exams','problems','problem_keys','exam_sessions','answer_drafts','file_assets','submissions','submission_attempts','submission_files','clarifications','announcements','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table private.device_sessions enable row level security;
alter table private.login_limits enable row level security;
-- Mọi ghi dữ liệu nghiệp vụ đi qua RPC kiểm tra vai trò; không mở INSERT/UPDATE tùy ý.
create policy profiles_read on public.profiles for select to authenticated using (
 public.current_role() is not null and (id=auth.uid() or public.is_admin() or (role='student' and public.manages_student(id)))
);
create policy classes_read on public.classes for select to authenticated using(public.in_class(id));
create policy membership_read on public.class_students for select to authenticated using(public.manages_class(class_id) or (coalesce(public.current_role()::text,'')='student' and student_id=auth.uid()));
create policy devices_read on public.user_devices for select to authenticated using(public.is_admin() or public.manages_student(user_id) or (public.current_role() is not null and user_id=auth.uid()));
create policy exams_read on public.exams for select to authenticated using(public.sees_exam(id));
create policy problems_read on public.problems for select to authenticated using(public.manages_exam(exam_id) or (public.sees_exam(exam_id) and exists(select 1 from public.exams e where e.id=exam_id and now()>=e.start_time and (exists(select 1 from public.exam_sessions s where s.exam_id=e.id and s.student_id=auth.uid()) or (e.publish_result and (e.status='closed' or now()>=e.end_time))))));
create policy answer_keys_staff on public.problem_keys for select to authenticated using(exists(select 1 from public.problems p where p.id=problem_id and public.manages_exam(p.exam_id)));
create policy sessions_read on public.exam_sessions for select to authenticated using(public.manages_exam(exam_id) or (student_id=auth.uid() and public.sees_exam(exam_id)));
create policy drafts_own on public.answer_drafts for select to authenticated using(student_id=auth.uid() and coalesce(public.current_role()::text,'')='student');
create policy files_read on public.file_assets for select to authenticated using(public.sees_file(id));
-- Học sinh đọc lịch sử qua RPC đã lọc điểm chưa công bố; raw SELECT chỉ dành cán bộ đúng lớp.
create policy submissions_staff on public.submissions for select to authenticated using(public.manages_exam(exam_id));
create policy attempts_staff on public.submission_attempts for select to authenticated using(exists(select 1 from public.submissions s where s.id=submission_id and public.manages_exam(s.exam_id)));
create policy attachments_read on public.submission_files for select to authenticated using(public.sees_file(file_id));
create policy clarifications_read on public.clarifications for select to authenticated using(public.manages_exam(exam_id) or (student_id=auth.uid() and public.sees_exam(exam_id)));
create policy announcements_read on public.announcements for select to authenticated using(public.sees_exam(exam_id));
create policy audit_admin on public.audit_logs for select to authenticated using(public.is_admin());
revoke all on all functions in schema public from public, anon;
grant execute on function public.current_role(),public.is_admin(),public.manages_class(uuid),public.in_class(uuid),public.manages_exam(uuid),public.sees_exam(uuid),public.manages_student(uuid),public.sees_file(uuid) to authenticated;

-- Script Admin đầu tiên cần đếm tài khoản Admin bằng khóa server.
grant select on public.profiles to service_role;
