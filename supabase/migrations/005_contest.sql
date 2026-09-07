alter table public.submissions add column score_multiplier numeric not null default 1 check(score_multiplier between 0 and 1);
create function private.parse_number(value text) returns numeric language plpgsql immutable set search_path='' as $$
declare v text:=replace(trim(value),',','.'); exponent text; begin
 if v is null or length(v)>80 or v !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then raise exception 'INVALID_NUMBER'; end if;
 if position('e' in lower(v))>0 then exponent:=split_part(lower(v),'e',2);if length(exponent)>4 or abs(exponent::integer)>100 then raise exception 'INVALID_NUMBER'; end if;end if;
 return v::numeric;
end $$;
create function private.validate_problem_key() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.problems where id=new.problem_id and answer_type='numeric') then perform private.parse_number(new.correct_answer);end if;
 return new;
end $$;
create trigger validate_numeric_key before insert or update on public.problem_keys for each row execute function private.validate_problem_key();
create function public.start_exam(eid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.exams; s public.exam_sessions; begin
 if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(eid) then raise exception 'FORBIDDEN'; end if;
 select * into e from public.exams where id=eid;
 if e.status<>'published' or now()<e.start_time or (now()>e.end_time and not e.allow_late_submission) then raise exception 'EXAM_NOT_OPEN'; end if;
 insert into public.exam_sessions(exam_id,student_id,deadline) values(eid,auth.uid(),least(e.end_time,now()+make_interval(mins=>e.duration))) on conflict(exam_id,student_id) do nothing;
 select * into s from public.exam_sessions where exam_id=eid and student_id=auth.uid();
 return jsonb_build_object('session',to_jsonb(s),'server_time',now());
end $$;
create function public.contest_data(eid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.exams; result jsonb; reveal boolean; begin
 if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(eid) then raise exception 'FORBIDDEN'; end if;
 select * into e from public.exams where id=eid;
 reveal:=e.publish_result and (e.status='closed' or now()>=e.end_time);
 result:=jsonb_build_object('exam',to_jsonb(e),'server_time',now(),
 'session',(select to_jsonb(s) from public.exam_sessions s where s.exam_id=eid and s.student_id=auth.uid()),
 'problems',coalesce((select jsonb_agg(to_jsonb(p) order by p.problem_number) from public.problems p where p.exam_id=eid and now()>=e.start_time and (reveal or exists(select 1 from public.exam_sessions s where s.exam_id=eid and s.student_id=auth.uid()))),'[]'::jsonb),
 'drafts',coalesce((select jsonb_agg(to_jsonb(d)) from public.answer_drafts d join public.problems p on p.id=d.problem_id where p.exam_id=eid and d.student_id=auth.uid()),'[]'::jsonb),
 'submissions',coalesce((select jsonb_agg((to_jsonb(s)-'auto_score'-'manual_score'-'final_score'-'comment'-'is_correct'-'status')||jsonb_build_object(
  'auto_score',case when reveal then s.auto_score else null end,'manual_score',case when reveal then s.manual_score else null end,
  'final_score',case when reveal then s.final_score else null end,'comment',case when reveal then s.comment else null end,
  'is_correct',case when reveal or e.scoring_mode<>'EXAM' then s.is_correct else null end,
  'status',case when not reveal and e.scoring_mode='EXAM' then 'SUBMITTED' else s.status::text end) order by s.attempt_number)
 from public.submissions s where s.exam_id=eid and s.student_id=auth.uid()),'[]'::jsonb),
 'files',coalesce((select jsonb_agg(to_jsonb(f)) from public.file_assets f where f.exam_id=eid and f.ready and public.sees_file(f.id)),'[]'::jsonb),
 'attachments',coalesce((select jsonb_agg(to_jsonb(f)) from public.submission_files f join public.submissions s on s.id=f.submission_id where s.exam_id=eid and s.student_id=auth.uid()),'[]'::jsonb),
 'announcements',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.announcements a where a.exam_id=eid),'[]'::jsonb),
 'clarifications',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.clarifications c where c.exam_id=eid and c.student_id=auth.uid()),'[]'::jsonb));
 if reveal then result:=result||jsonb_build_object('keys',coalesce((select jsonb_agg(to_jsonb(k)) from public.problem_keys k join public.problems p on p.id=k.problem_id where p.exam_id=eid),'[]'::jsonb));end if;
 return result;
end $$;
create function public.save_draft(pid uuid, value text, input_unit text, expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.problems; e public.exams; d public.answer_drafts; begin
 select * into p from public.problems where id=pid;
 if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(p.exam_id) then raise exception 'FORBIDDEN';end if;
 select * into e from public.exams where id=p.exam_id;
 if e.status<>'published' or not exists(select 1 from public.exam_sessions where exam_id=p.exam_id and student_id=auth.uid() and finished_at is null and (now()<=deadline or e.allow_late_submission)) then raise exception 'TIME_EXPIRED';end if;
 if length(value)>20000 or length(input_unit)>80 then raise exception 'INVALID_ANSWER';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||pid::text,1));
 select * into d from public.answer_drafts where problem_id=pid and student_id=auth.uid();
 if coalesce(d.revision,0)<>expected_revision then return jsonb_build_object('conflict',true,'draft',to_jsonb(d));end if;
 insert into public.answer_drafts(problem_id,student_id,answer,unit,revision) values(pid,auth.uid(),value,input_unit,1)
 on conflict(problem_id,student_id) do update set answer=excluded.answer,unit=excluded.unit,revision=public.answer_drafts.revision+1,updated_at=now() returning * into d;
 return jsonb_build_object('conflict',false,'draft',to_jsonb(d));
end $$;
create function public.submit_answer(pid uuid, value text, input_unit text, file_ids uuid[], request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.problems; e public.exams; k public.problem_keys; sess public.exam_sessions; prev public.submissions; attempt integer; lim integer;
 n numeric; correct numeric; solved boolean; score numeric:=0; multiplier numeric:=1; sid uuid; st public.problem_status; begin
 select * into p from public.problems where id=pid;
 if p.id is null or coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(p.exam_id) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||pid::text,0));
 select * into prev from public.submissions where student_id=auth.uid() and request_id=request_key;
 if found then if prev.problem_id<>pid then raise exception 'INVALID_REQUEST';end if;return jsonb_build_object('id',prev.id,'duplicate',true);end if;
 select * into e from public.exams where id=p.exam_id;
 select * into sess from public.exam_sessions where exam_id=e.id and student_id=auth.uid() for update;
 if e.status<>'published' or now()<e.start_time or sess.id is null then raise exception 'EXAM_NOT_OPEN';end if;
 if sess.finished_at is not null then raise exception 'ALREADY_FINISHED';end if;
 if now()>sess.deadline and not e.allow_late_submission then raise exception 'TIME_EXPIRED';end if;
 select count(*)+1 into attempt from public.submissions where problem_id=pid and student_id=auth.uid();
 lim:=case when e.scoring_mode='EXAM' then 1 else p.max_attempts end;
 if lim is not null and attempt>lim then raise exception 'ATTEMPTS_EXHAUSTED';end if;
 if length(value)>20000 or length(input_unit)>80 or (p.answer_type<>'file_only' and nullif(trim(value),'') is null) then raise exception 'INVALID_ANSWER';end if;
 if cardinality(file_ids)>6 or cardinality(file_ids)<>(select count(distinct x) from unnest(file_ids) x) then raise exception 'INVALID_FILES';end if;
 if (select count(*) from public.file_assets f where f.id=any(file_ids) and f.owner_id=auth.uid() and f.problem_id=pid and f.exam_id=e.id and f.bucket='submissions' and f.ready)<>cardinality(file_ids) then raise exception 'INVALID_FILES';end if;
 if (p.require_solution or p.answer_type='file_only') and coalesce(cardinality(file_ids),0)=0 then raise exception 'SOLUTION_REQUIRED';end if;
 select * into k from public.problem_keys where problem_id=pid;
 if p.answer_type='numeric' then
  n:=private.parse_number(value);correct:=private.parse_number(k.correct_answer);
  solved:=abs(n-correct)<=case when k.tolerance_type='relative' then abs(correct)*k.tolerance_value else k.tolerance_value end;
 elsif p.answer_type='text' then solved:=lower(trim(value))=lower(trim(k.correct_answer));end if;
 -- Đơn vị phải đúng đơn vị yêu cầu; không tự đổi hệ đơn vị âm thầm.
 if p.answer_type in ('numeric','text') and nullif(trim(p.unit),'') is not null then solved:=solved and lower(trim(input_unit))=lower(trim(p.unit));end if;
 if e.scoring_mode='CHALLENGE' then multiplier:=e.attempt_weights[least(attempt,cardinality(e.attempt_weights))];end if;
 score:=case when solved then p.auto_points*multiplier else 0 end;
 st:=case when p.answer_type in ('essay','file_only') or p.points>p.auto_points then 'SUBMITTED'::public.problem_status when solved then 'SOLVED'::public.problem_status else 'ATTEMPTED'::public.problem_status end;
 insert into public.submissions(exam_id,problem_id,student_id,answer,numeric_value,unit,attempt_number,solution_path,status,is_correct,auto_score,submitted_at,is_late,request_id,score_multiplier)
 values(e.id,pid,auth.uid(),coalesce(value,''),n,coalesce(input_unit,''),attempt,(select path from public.file_assets where id=file_ids[1]),st,solved,score,now(),now()>sess.deadline,request_key,multiplier) returning id into sid;
 insert into public.submission_attempts(submission_id) values(sid);
 insert into public.submission_files(submission_id,file_id,sort_order) select sid,x.id,(x.n-1)::int from unnest(file_ids) with ordinality as x(id,n);
 return jsonb_build_object('id',sid,'duplicate',false);
end $$;
create function public.finish_exam(eid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(eid) then raise exception 'FORBIDDEN';end if;
 update public.exam_sessions set finished_at=coalesce(finished_at,now()) where exam_id=eid and student_id=auth.uid();
end $$;
create function public.ask_clarification(pid uuid, question_text text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.problems; rid uuid; begin
 select * into p from public.problems where id=pid;
 if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(p.exam_id) or not exists(select 1 from public.exams where id=p.exam_id and status='published' and now()>=start_time) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p.exam_id::text,2));
 if (select count(*) from public.clarifications where student_id=auth.uid() and exam_id=p.exam_id and created_at>now()-interval '1 minute')>=3 then raise exception 'CLARIFICATION_RATE_LIMIT';end if;
 insert into public.clarifications(exam_id,problem_id,student_id,question) values(p.exam_id,pid,auth.uid(),trim(question_text)) returning id into rid;return rid;
end $$;
-- Điểm tự luận gốc được kiểm tra theo ngân sách Problem; hệ số CHALLENGE áp dụng toàn bài.
revoke all on function public.start_exam(uuid),public.contest_data(uuid),public.save_draft(uuid,text,text,bigint),public.submit_answer(uuid,text,text,uuid[],uuid),public.finish_exam(uuid),public.ask_clarification(uuid,text) from public,anon;
grant execute on function public.start_exam(uuid),public.contest_data(uuid),public.save_draft(uuid,text,text,bigint),public.submit_answer(uuid,text,text,uuid[],uuid),public.finish_exam(uuid),public.ask_clarification(uuid,text) to authenticated;
create function public.my_progress() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('exam_id',e.id,'total',(select count(*) from public.problems p where p.exam_id=e.id),'completed',(select count(distinct s.problem_id) from public.submissions s where s.exam_id=e.id and s.student_id=auth.uid()))),'[]'::jsonb)
 from public.exams e where coalesce(public.current_role()::text,'')='student' and public.sees_exam(e.id)
$$;
revoke all on function public.my_progress() from public,anon;
grant execute on function public.my_progress() to authenticated;
