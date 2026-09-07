create function public.bind_device(uid uuid, fingerprint text, sid uuid, info text) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.user_devices; begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.profiles where id=uid and active) then return false; end if;
 select * into d from public.user_devices where user_id=uid and active for update;
 if found and d.device_id<>fingerprint then return false; end if;
 if d.id is null then insert into public.user_devices(user_id,device_id,browser_info) values(uid,fingerprint,left(info,500)) returning * into d;
 else update public.user_devices set last_seen_at=now() where id=d.id; end if;
 insert into private.device_sessions(session_id,user_id,device_id) values(sid,uid,d.id) on conflict(session_id) do nothing;
 return true;
end $$;
create function public.check_login_rate(k text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into private.login_limits(key) values(k) on conflict(key) do update set
 count=case when private.login_limits.window_at<now()-interval '15 minutes' then 1 else private.login_limits.count+1 end,
 window_at=case when private.login_limits.window_at<now()-interval '15 minutes' then now() else private.login_limits.window_at end returning count into n;
 delete from private.login_limits where window_at<now()-interval '1 day';
 return n<=15;
end $$;
-- Không có đăng ký tự do. Chỉ Auth Admin API với app_metadata do server gán.
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_app_meta_data->>'portal_role' is null then raise exception 'ACCOUNT_CREATION_REQUIRES_ADMIN'; end if;
 insert into public.profiles(id,username,full_name,role,created_by) values(new.id,lower(new.raw_app_meta_data->>'portal_username'),new.raw_app_meta_data->>'portal_name',(new.raw_app_meta_data->>'portal_role')::public.app_role,nullif(new.raw_app_meta_data->>'portal_created_by','')::uuid);
 return new;
end $$;
create trigger new_portal_user after insert on auth.users for each row execute function private.new_profile();
create function public.manage(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid; eid uuid; cid uuid; actor_role public.app_role:=public.current_role(); e public.exams; p public.problems; s public.submissions; v jsonb; begin
 if actor_role is null then raise exception 'FORBIDDEN'; end if;
 rid:=nullif(payload->>'id','')::uuid;
 if action='class_save' then
  if actor_role<>'admin' then raise exception 'FORBIDDEN'; end if;
  if nullif(payload->>'teacher_id','') is not null and not exists(select 1 from public.profiles where id=(payload->>'teacher_id')::uuid and profiles.role='teacher' and active) then raise exception 'INVALID_TEACHER'; end if;
  if rid is null then insert into public.classes(name,teacher_id) values(payload->>'name',nullif(payload->>'teacher_id','')::uuid) returning id into rid;
  else update public.classes set name=payload->>'name',teacher_id=nullif(payload->>'teacher_id','')::uuid where id=rid; end if;
 elsif action='enroll' then
  cid:=(payload->>'class_id')::uuid;
  if not public.manages_class(cid) or not exists(select 1 from public.profiles sp where sp.id=(payload->>'student_id')::uuid and sp.role='student' and (
   public.is_admin() or public.manages_student(sp.id) or (sp.created_by=uid and not exists(select 1 from public.class_students cs where cs.student_id=sp.id))
  )) then raise exception 'FORBIDDEN'; end if;
  insert into public.class_students(class_id,student_id) values(cid,(payload->>'student_id')::uuid) on conflict do nothing;
 elsif action in ('lock_user','reset_device') then
  if not exists(select 1 from public.profiles where id=rid and (actor_role='admin' or (profiles.role='student' and public.manages_student(rid)))) or rid=uid then raise exception 'FORBIDDEN'; end if;
  if action='lock_user' then update public.profiles set active=(payload->>'active')::boolean where id=rid; end if;
  if action='reset_device' or not (payload->>'active')::boolean then
   update public.user_devices set active=false where user_id=rid;
   delete from private.device_sessions where user_id=rid;
  end if;
 elsif action='exam_save' then
  cid:=(payload->>'class_id')::uuid;
  if not public.manages_class(cid) then raise exception 'FORBIDDEN'; end if;
  if rid is not null then
   select * into e from public.exams where id=rid for update;
   if not public.manages_exam(rid) or e.status<>'draft' then raise exception 'EXAM_LOCKED'; end if;
   update public.exams set title=payload->>'title',description=coalesce(payload->>'description',''),class_id=cid,
    start_time=(payload->>'start_time')::timestamptz,end_time=(payload->>'end_time')::timestamptz,duration=(payload->>'duration')::int,
    scoring_mode=payload->>'scoring_mode',allow_late_submission=(payload->>'allow_late_submission')::boolean,
    attempt_weights=array(select jsonb_array_elements_text(payload->'attempt_weights')::numeric) where id=rid;
  else insert into public.exams(title,description,class_id,teacher_id,start_time,end_time,duration,scoring_mode,allow_late_submission,attempt_weights)
   values(payload->>'title',coalesce(payload->>'description',''),cid,uid,(payload->>'start_time')::timestamptz,(payload->>'end_time')::timestamptz,(payload->>'duration')::int,payload->>'scoring_mode',(payload->>'allow_late_submission')::boolean,array(select jsonb_array_elements_text(payload->'attempt_weights')::numeric)) returning id into rid;
  end if;
 elsif action='problem_save' then
  eid:=(payload->>'exam_id')::uuid;
  select * into e from public.exams where id=eid for update;
  if not public.manages_exam(eid) or e.status<>'draft' then raise exception 'EXAM_LOCKED'; end if;
  if rid is not null and not exists(select 1 from public.problems where id=rid and exam_id=eid) then raise exception 'FORBIDDEN'; end if;
  rid:=coalesce(rid,gen_random_uuid());
  insert into public.problems(id,exam_id,problem_number,title,answer_type,unit,max_attempts,points,auto_points,require_solution)
   values(rid,eid,(payload->>'problem_number')::int,coalesce(payload->>'title',''),(payload->>'answer_type')::public.answer_kind,coalesce(payload->>'unit',''),nullif(payload->>'max_attempts','')::int,(payload->>'points')::numeric,(payload->>'auto_points')::numeric,(payload->>'require_solution')::boolean)
   on conflict(id) do update set problem_number=excluded.problem_number,title=excluded.title,answer_type=excluded.answer_type,unit=excluded.unit,max_attempts=excluded.max_attempts,points=excluded.points,auto_points=excluded.auto_points,require_solution=excluded.require_solution;
  insert into public.problem_keys(problem_id,correct_answer,tolerance_type,tolerance_value) values(rid,payload->>'correct_answer',payload->>'tolerance_type',(payload->>'tolerance_value')::numeric)
   on conflict(problem_id) do update set correct_answer=excluded.correct_answer,tolerance_type=excluded.tolerance_type,tolerance_value=excluded.tolerance_value;
 elsif action='problem_delete' then
  select * into p from public.problems where id=rid;
  select * into e from public.exams where id=p.exam_id for update;
  if not public.manages_exam(e.id) or e.status<>'draft' then raise exception 'EXAM_LOCKED'; end if;
  delete from public.file_assets where problem_id=rid;
  delete from public.problems where id=rid;
 elsif action in ('exam_publish','exam_close','publish_result') then
  select * into e from public.exams where id=rid for update;
  if not public.manages_exam(rid) then raise exception 'FORBIDDEN'; end if;
  if action='exam_publish' then
   if e.status<>'draft' or e.pdf_path is null or not exists(select 1 from public.problems where exam_id=rid) then raise exception 'EXAM_INCOMPLETE'; end if;
   if exists(select 1 from public.problems qp join public.problem_keys qk on qk.problem_id=qp.id where qp.exam_id=rid and qp.answer_type in ('numeric','text') and nullif(trim(qk.correct_answer),'') is null) then raise exception 'ANSWER_KEY_REQUIRED'; end if;
   update public.exams set status='published' where id=rid;
  elsif action='exam_close' then update public.exams set status='closed' where id=rid;
  else
   if e.status<>'closed' and now()<e.end_time then raise exception 'RESULTS_REQUIRE_EXAM_END'; end if;
   if e.allow_late_submission and e.status<>'closed' then raise exception 'CLOSE_EXAM_BEFORE_RESULTS'; end if;
   update public.exams set publish_result=(payload->>'publish')::boolean where id=rid;
  end if;
 elsif action='grade' then
  select * into s from public.submissions where id=rid for update;
  select * into p from public.problems where id=s.problem_id;
  if not public.manages_exam(s.exam_id) then raise exception 'FORBIDDEN'; end if;
  if (payload->>'manual_score')::numeric<0 or (payload->>'manual_score')::numeric>p.points-p.auto_points then raise exception 'INVALID_SCORE'; end if;
  update public.submissions set manual_score=(payload->>'manual_score')::numeric*s.score_multiplier,comment=left(coalesce(payload->>'comment',''),4000),status='REVIEWED' where id=rid;
 elsif action='announce' then
  eid:=(payload->>'exam_id')::uuid;
  if not public.manages_exam(eid) then raise exception 'FORBIDDEN'; end if;
  insert into public.announcements(exam_id,author_id,content) values(eid,uid,payload->>'content') returning id into rid;
 elsif action='reply' then
  select exam_id into eid from public.clarifications where id=rid for update;
  if not public.manages_exam(eid) then raise exception 'FORBIDDEN'; end if;
  update public.clarifications set answer=left(payload->>'answer',4000),replied_by=uid,replied_at=now() where id=rid;
  if (payload->>'publish')::boolean then
   insert into public.announcements(exam_id,author_id,content) values(eid,uid,left(payload->>'answer',4000));
  end if;
 else raise exception 'UNKNOWN_ACTION'; end if;
 insert into public.audit_logs(actor_id,action,target_id) values(uid,action,rid);
 return jsonb_build_object('id',rid,'ok',true);
end $$;
revoke all on function public.bind_device(uuid,text,uuid,text),public.check_login_rate(text),public.manage(text,jsonb) from public,anon,authenticated;
grant execute on function public.bind_device(uuid,text,uuid,text),public.check_login_rate(text) to service_role;
grant execute on function public.manage(text,jsonb) to authenticated;
