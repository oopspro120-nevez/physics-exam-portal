-- Upgrade after 001–006. Existing exams, accounts and submissions are preserved.
begin;
alter table private.device_sessions
 add column last_activity_at timestamptz not null default now(),
 add column closed_at timestamptz;
create table private.session_tabs (
 session_id uuid not null references private.device_sessions(session_id) on delete cascade,
 tab_id uuid not null,
 last_seen_at timestamptz not null default now(),
 closed_at timestamptz,
 primary key(session_id,tab_id)
);
alter table private.session_tabs enable row level security;
revoke all on private.session_tabs from public,anon,authenticated;

create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p where p.id=auth.uid() and p.active and exists (
  select 1 from private.device_sessions s join public.user_devices d on d.id=s.device_id
  where s.user_id=p.id and s.session_id=(auth.jwt()->>'session_id')::uuid and d.active
   and s.last_activity_at>now()-interval '30 minutes'
   and (s.closed_at is null or s.closed_at>now()-interval '60 seconds'))
$$;

create or replace function public.bind_device(uid uuid, fingerprint text, sid uuid, info text)
returns boolean language plpgsql security definer set search_path='' as $$
declare d public.user_devices; begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.profiles where id=uid and active) then return false; end if;
 delete from private.device_sessions where user_id=uid and
  (last_activity_at<=now()-interval '30 minutes' or closed_at<=now()-interval '60 seconds');
 update public.user_devices ud set active=false where ud.user_id=uid and ud.active
  and not exists(select 1 from private.device_sessions s where s.device_id=ud.id);
 select * into d from public.user_devices where user_id=uid and active for update;
 if found and d.device_id<>fingerprint then return false; end if;
 if d.id is null then
  insert into public.user_devices(user_id,device_id,browser_info)
   values(uid,fingerprint,left(info,500)) returning * into d;
 else update public.user_devices set last_seen_at=now() where id=d.id; end if;
 delete from private.device_sessions where user_id=uid and session_id<>sid;
 insert into private.device_sessions(session_id,user_id,device_id,last_activity_at)
  values(sid,uid,d.id,now()) on conflict(session_id) do update
  set device_id=excluded.device_id,last_activity_at=now(),closed_at=null;
 return true;
end $$;

create function public.portal_context(fingerprint text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; s private.device_sessions; begin
 if public.current_role() is null then raise exception 'SESSION_EXPIRED'; end if;
 select ds.* into s from private.device_sessions ds join public.user_devices d on d.id=ds.device_id
  where ds.session_id=(auth.jwt()->>'session_id')::uuid and ds.user_id=auth.uid()
  and d.active and d.device_id=fingerprint;
 if not found then raise exception 'DEVICE_DENIED'; end if;
 select * into p from public.profiles where id=auth.uid();
 return jsonb_build_object('profile',to_jsonb(p),'session_id',s.session_id,
  'expires_at',s.last_activity_at+interval '30 minutes','server_time',now());
end $$;

-- Only genuine input reported by the UI updates last_activity_at, never polling.
create function public.portal_session(op text, tid uuid, fingerprint text, activity_age_ms integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.device_sessions; stamp timestamptz; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if op not in ('open','heartbeat','close') or tid is null then raise exception 'FORBIDDEN'; end if;
 if public.current_role() is null then raise exception 'SESSION_EXPIRED'; end if;
 select ds.* into s from private.device_sessions ds join public.user_devices d on d.id=ds.device_id
  where ds.session_id=(auth.jwt()->>'session_id')::uuid and ds.user_id=auth.uid()
  and d.active and d.device_id=fingerprint for update of ds;
 if not found then raise exception 'DEVICE_DENIED'; end if;
 if op='close' then
  update private.session_tabs set closed_at=now() where session_id=s.session_id and tab_id=tid;
  if found and not exists(select 1 from private.session_tabs where session_id=s.session_id
    and closed_at is null and last_seen_at>now()-interval '30 minutes') then
   update private.device_sessions set closed_at=coalesce(closed_at,now()) where session_id=s.session_id;
  end if;
 else
  insert into private.session_tabs(session_id,tab_id) values(s.session_id,tid)
   on conflict(session_id,tab_id) do update set last_seen_at=now(),closed_at=null;
  stamp:=case when activity_age_ms between 0 and 1799999
   then now()-activity_age_ms*interval '1 millisecond' else s.last_activity_at end;
  update private.device_sessions set closed_at=null,last_activity_at=greatest(last_activity_at,stamp)
   where session_id=s.session_id returning * into s;
  update public.user_devices set last_seen_at=now() where id=s.device_id;
  delete from private.session_tabs where session_id=s.session_id and last_seen_at<=now()-interval '30 minutes';
 end if;
 return jsonb_build_object('expires_at',s.last_activity_at+interval '30 minutes','server_time',now());
end $$;

create function public.end_portal_session(fingerprint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare did uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select s.device_id into did from private.device_sessions s join public.user_devices d on d.id=s.device_id
  where s.session_id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and d.device_id=fingerprint;
 if did is null then return false; end if;
 delete from private.device_sessions where device_id=did;
 update public.user_devices set active=false where id=did;
 return true;
end $$;
revoke all on function public.portal_context(text),public.portal_session(text,uuid,text,integer),public.end_portal_session(text) from public,anon;
grant execute on function public.portal_context(text),public.portal_session(text,uuid,text,integer),public.end_portal_session(text) to authenticated;
commit;
