create function public.register_file(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.exams; f public.file_assets; b text:=payload->>'bucket'; eid uuid:=(payload->>'exam_id')::uuid; pid uuid:=nullif(payload->>'problem_id','')::uuid; begin
 select * into e from public.exams where id=eid;
 if b in ('exams','solutions') then
  if not public.manages_exam(eid) or (b='exams' and e.status<>'draft') then raise exception 'FORBIDDEN'; end if;
 elsif b='submissions' then
  if coalesce(public.current_role()::text,'')<>'student' or not public.sees_exam(eid) or e.status<>'published' or now()<e.start_time then raise exception 'EXAM_NOT_OPEN'; end if;
  if not exists(select 1 from public.exam_sessions where exam_id=eid and student_id=auth.uid() and finished_at is null and (now()<=deadline or e.allow_late_submission)) then raise exception 'TIME_EXPIRED'; end if;
 else raise exception 'FORBIDDEN'; end if;
 if b<>'exams' and (pid is null or not exists(select 1 from public.problems where id=pid and exam_id=eid)) then raise exception 'FORBIDDEN'; end if;
 if (payload->>'size_bytes')::bigint > (case when b='exams' then 26214400 else 15728640 end) or
 (b='exams' and payload->>'mime_type'<>'application/pdf') or payload->>'mime_type' not in ('application/pdf','image/jpeg','image/png') then raise exception 'INVALID_FILES'; end if;
 if b='submissions' and (select count(*) from public.file_assets where exam_id=eid and problem_id=pid and owner_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'FILE_UPLOAD_LIMIT'; end if;
 insert into public.file_assets(id,owner_id,exam_id,problem_id,bucket,path,name,mime_type,size_bytes)
 values((payload->>'id')::uuid,auth.uid(),eid,pid,b,payload->>'path',left(payload->>'name',180),payload->>'mime_type',(payload->>'size_bytes')::bigint) returning * into f;
 return to_jsonb(f);
end $$;
create function public.complete_file(fid uuid, actual_size bigint, actual_mime text) returns void language plpgsql security definer set search_path='' as $$
declare f public.file_assets; begin
 select * into f from public.file_assets where id=fid for update;
 if f.id is null or f.size_bytes<>actual_size or f.mime_type<>actual_mime then raise exception 'INVALID_FILES'; end if;
 if f.bucket='exams' then
  perform 1 from public.exams where id=f.exam_id and status='draft' for update;
  if not found then raise exception 'EXAM_LOCKED'; end if;
  update public.exams set pdf_path=f.path where id=f.exam_id;
 elsif f.bucket='solutions' then update public.problem_keys set solution_path=f.path where problem_id=f.problem_id;
 end if;
 update public.file_assets set ready=true where id=fid;
end $$;
revoke all on function public.register_file(jsonb),public.complete_file(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.register_file(jsonb) to authenticated;
grant execute on function public.complete_file(uuid,bigint,text) to service_role;
-- Chỉ phiên bản đề/đáp án hiện tại được học sinh truy cập.
create or replace function public.sees_file(fid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.file_assets f join public.exams e on e.id=f.exam_id where f.id=fid and (
 public.manages_exam(e.id) or (public.sees_exam(e.id) and (
 (f.bucket='submissions' and f.owner_id=auth.uid()) or
 (f.bucket='exams' and now()>=e.start_time and e.pdf_path=f.path and (exists(select 1 from public.exam_sessions s where s.exam_id=e.id and s.student_id=auth.uid()) or (e.publish_result and (e.status='closed' or now()>=e.end_time)))) or
 (f.bucket='solutions' and e.publish_result and (e.status='closed' or now()>=e.end_time) and exists(select 1 from public.problem_keys k where k.problem_id=f.problem_id and k.solution_path=f.path))))))
$$;
