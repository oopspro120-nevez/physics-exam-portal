-- Run once after 007. No existing files or submissions are removed.
begin;
create or replace function public.register_file(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.exams; f public.file_assets; b text:=payload->>'bucket'; eid uuid:=(payload->>'exam_id')::uuid; pid uuid:=nullif(payload->>'problem_id','')::uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(payload->>'id',1));
 select * into f from public.file_assets where id=(payload->>'id')::uuid;
 if found then
  if public.current_role() is null or f.owner_id<>auth.uid() or f.exam_id<>eid or f.bucket<>b
   or f.problem_id is distinct from pid or f.size_bytes<>(payload->>'size_bytes')::bigint
   or f.mime_type<>payload->>'mime_type' or f.path<>payload->>'path' then raise exception 'INVALID_FILES'; end if;
  return to_jsonb(f);
 end if;
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
create or replace function public.complete_file(fid uuid, actual_size bigint, actual_mime text) returns void language plpgsql security definer set search_path='' as $$
declare f public.file_assets; begin
 select * into f from public.file_assets where id=fid for update;
 if f.id is null or f.size_bytes<>actual_size or f.mime_type<>actual_mime then raise exception 'INVALID_FILES'; end if;
 if f.ready then return; end if;
 if f.bucket='exams' then
  perform 1 from public.exams where id=f.exam_id and status='draft' for update;
  if not found then raise exception 'EXAM_LOCKED'; end if;
  update public.exams set pdf_path=f.path where id=f.exam_id;
 elsif f.bucket='solutions' then update public.problem_keys set solution_path=f.path where problem_id=f.problem_id;
 end if;
 update public.file_assets set ready=true where id=fid;
end $$;

alter table public.exams add column create_request_id uuid;
create unique index exams_create_request_idx on public.exams(teacher_id,create_request_id) where create_request_id is not null;
create index file_assets_problem_idx on public.file_assets(problem_id,owner_id);
create index file_assets_bucket_path_idx on public.file_assets(bucket,path) where ready;

-- Preserve existing business rules; route creation/publication through atomic guards.
alter function public.manage(text,jsonb) rename to manage_legacy;
revoke all on function public.manage_legacy(text,jsonb) from public,anon,authenticated;
create function public.manage(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.exams; result jsonb; request_id uuid:=nullif(payload->>'request_id','')::uuid; begin
 if public.current_role() is null then raise exception 'FORBIDDEN'; end if;
 if action='exam_publish' then
  select * into e from public.exams where id=(payload->>'id')::uuid for update;
  if e.id is null or not public.manages_exam(e.id) then raise exception 'FORBIDDEN'; end if;
  if e.status='published' then return jsonb_build_object('id',e.id,'ok',true); end if;
  if e.status<>'draft' then raise exception 'EXAM_LOCKED'; end if;
  if e.end_time<=now() then raise exception 'EXAM_SCHEDULE_PAST'; end if;
  if not exists(select 1 from public.file_assets where exam_id=e.id and bucket='exams' and path=e.pdf_path and ready)
   or not exists(select 1 from public.problems where exam_id=e.id) then raise exception 'EXAM_INCOMPLETE'; end if;
  if exists(select 1 from public.problems p left join public.problem_keys k on k.problem_id=p.id
   where p.exam_id=e.id and p.answer_type in ('numeric','text') and nullif(trim(k.correct_answer),'') is null)
   then raise exception 'ANSWER_KEY_REQUIRED'; end if;
  return public.manage_legacy(action,payload);
 elsif action='exam_save' and nullif(payload->>'id','') is null and request_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||request_id::text,2));
  select * into e from public.exams where teacher_id=auth.uid() and create_request_id=request_id;
  if found then
   if not public.manages_exam(e.id) then raise exception 'FORBIDDEN'; end if;
   return jsonb_build_object('id',e.id,'ok',true);
  end if;
  result:=public.manage_legacy(action,payload);
  update public.exams set create_request_id=request_id where id=(result->>'id')::uuid;
  return result;
 end if;
 return public.manage_legacy(action,payload);
end $$;
revoke all on function public.manage(text,jsonb) from public,anon;
grant execute on function public.manage(text,jsonb) to authenticated;

commit;
