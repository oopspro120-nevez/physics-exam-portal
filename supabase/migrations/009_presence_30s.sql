-- 009: release a bound device after 30 seconds without network heartbeat.
-- Safe to run after 007_session_lifecycle.sql. Existing accounts/exams are preserved.
begin;

alter table private.device_sessions
  add column if not exists last_heartbeat_at timestamptz;

update private.device_sessions
set last_heartbeat_at = coalesce(last_heartbeat_at, last_activity_at, now())
where last_heartbeat_at is null;

alter table private.device_sessions
  alter column last_heartbeat_at set default now(),
  alter column last_heartbeat_at set not null;

create or replace function public.bind_device(uid uuid, fingerprint text, sid uuid, info text)
returns boolean language plpgsql security definer set search_path='' as $$
declare d public.user_devices; begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.profiles where id=uid and active) then return false; end if;

 -- A device that has not reached the server for 30 seconds no longer blocks a new login.
 delete from private.device_sessions
 where user_id=uid and (
   last_heartbeat_at<=now()-interval '30 seconds'
   or last_activity_at<=now()-interval '30 minutes'
   or closed_at<=now()-interval '60 seconds'
 );

 update public.user_devices ud set active=false
 where ud.user_id=uid and ud.active
   and not exists(select 1 from private.device_sessions s where s.device_id=ud.id);

 select * into d from public.user_devices where user_id=uid and active for update;
 if found and d.device_id<>fingerprint then return false; end if;

 if d.id is null then
  insert into public.user_devices(user_id,device_id,browser_info)
   values(uid,fingerprint,left(info,500)) returning * into d;
 else
  update public.user_devices set last_seen_at=now() where id=d.id;
 end if;

 delete from private.device_sessions where user_id=uid and session_id<>sid;
 insert into private.device_sessions(session_id,user_id,device_id,last_activity_at,last_heartbeat_at)
  values(sid,uid,d.id,now(),now())
 on conflict(session_id) do update
  set device_id=excluded.device_id,
      last_activity_at=now(),
      last_heartbeat_at=now(),
      closed_at=null;
 return true;
end $$;

create or replace function public.portal_session(op text, tid uuid, fingerprint text, activity_age_ms integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.device_sessions; stamp timestamptz; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if op not in ('open','heartbeat','close') or tid is null then raise exception 'FORBIDDEN'; end if;
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active)
   then raise exception 'SESSION_EXPIRED'; end if;

 select ds.* into s
 from private.device_sessions ds
 join public.user_devices d on d.id=ds.device_id
 where ds.session_id=(auth.jwt()->>'session_id')::uuid
   and ds.user_id=auth.uid()
   and d.active
   and d.device_id=fingerprint
 for update of ds;
 if not found then raise exception 'DEVICE_DENIED'; end if;
 if s.last_activity_at<=now()-interval '30 minutes' then raise exception 'SESSION_EXPIRED'; end if;

 if op='close' then
  update private.session_tabs set closed_at=now()
   where session_id=s.session_id and tab_id=tid;
  if found and not exists(
    select 1 from private.session_tabs
    where session_id=s.session_id and closed_at is null
      and last_seen_at>now()-interval '30 minutes'
  ) then
   update private.device_sessions set closed_at=coalesce(closed_at,now())
    where session_id=s.session_id;
  end if;
 else
  insert into private.session_tabs(session_id,tab_id)
   values(s.session_id,tid)
  on conflict(session_id,tab_id) do update
   set last_seen_at=now(),closed_at=null;

  stamp:=case when activity_age_ms between 0 and 1799999
   then now()-activity_age_ms*interval '1 millisecond'
   else s.last_activity_at end;

  update private.device_sessions
   set closed_at=null,
       last_heartbeat_at=now(),
       last_activity_at=greatest(last_activity_at,stamp)
   where session_id=s.session_id
   returning * into s;

  update public.user_devices set last_seen_at=now() where id=s.device_id;
  delete from private.session_tabs
   where session_id=s.session_id and last_seen_at<=now()-interval '30 minutes';
 end if;

 return jsonb_build_object(
   'expires_at',s.last_activity_at+interval '30 minutes',
   'server_time',now()
 );
end $$;

revoke all on function public.bind_device(uuid,text,uuid,text),public.portal_session(text,uuid,text,integer)
 from public,anon;
grant execute on function public.bind_device(uuid,text,uuid,text) to service_role;
grant execute on function public.portal_session(text,uuid,text,integer) to authenticated;

commit;
