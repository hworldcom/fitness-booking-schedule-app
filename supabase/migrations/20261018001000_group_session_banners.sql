-- DEV0356: independently revisioned presentation; existing session terms stay fixed.
create table app.group_session_banners (
  run_id uuid not null,
  session_id uuid primary key,
  coach_profile_id uuid not null,
  revision integer not null default 0 check(revision>=0),
  card_path text,
  hero_path text,
  updated_at timestamptz not null default statement_timestamp(),
  foreign key(run_id,session_id) references app.coach_group_sessions(run_id,id) on delete cascade,
  foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id),
  check ((card_path is null and hero_path is null) or
    (card_path is not null and hero_path is not null and card_path<>hero_path
      and card_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      and hero_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      and split_part(card_path,'/',1)=coach_profile_id::text
      and split_part(hero_path,'/',1)=coach_profile_id::text))
);
alter table app.group_session_banners owner to app_owner;
alter table app.group_session_banners enable row level security;
alter table app.group_session_banners force row level security;
revoke all on app.group_session_banners from public,anon,authenticated,app_runtime;
create policy group_banner_internal on app.group_session_banners to app_owner using(true) with check(true);

create function app.owned_group_session_banner(requested_id uuid)
returns table(session_id uuid,coach_profile_id uuid,revision integer,card_path text,hero_path text,editable boolean)
language plpgsql security definer set search_path='' as $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'event banner forbidden' using errcode='42501'; end if;
  actor:=current_setting('app.current_profile_id')::uuid; dataset:=current_setting('app.current_run_id')::uuid;
  perform app.group_session_flags(true);
  select * into activity from app.coach_group_sessions g where g.id=requested_id and g.run_id=dataset and g.coach_profile_id=actor;
  if not found or not app.group_coach_enabled(dataset,actor,false) then raise exception 'event banner forbidden' using errcode='42501'; end if;
  return query select activity.id,actor,coalesce(b.revision,0),b.card_path,b.hero_path,
    activity.status='draft' or (activity.status in ('open','confirmed') and activity.starts_at>clock_timestamp()
      and (activity.status='confirmed' or activity.decision_deadline_at>clock_timestamp()))
    from (select 1) placeholder left join app.group_session_banners b on b.session_id=activity.id;
  perform app.group_session_flags(false);
end $$;
alter function app.owned_group_session_banner(uuid) owner to app_owner;
revoke all on function app.owned_group_session_banner(uuid) from public,anon,authenticated;
grant execute on function app.owned_group_session_banner(uuid) to app_runtime;

create function app.event_banner_object_exists(requested_path text,maximum_bytes bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from storage.objects o where o.bucket_id='event-banners' and o.name=requested_path
    and o.metadata->>'mimetype'='image/webp' and (o.metadata->>'size')::bigint between 1 and maximum_bytes)
$$;
alter function app.event_banner_object_exists(text,bigint) owner to postgres;
revoke all on function app.event_banner_object_exists(text,bigint) from public,anon,authenticated;
grant execute on function app.event_banner_object_exists(text,bigint) to app_owner;

create function app.mutate_owned_group_session_banner(requested_id uuid,expected_revision integer,requested_card text,requested_hero text)
returns table(previous_card_path text,previous_hero_path text,revision integer,card_path text,hero_path text)
language plpgsql security definer set search_path='' as $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; previous app.group_session_banners;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'event banner forbidden' using errcode='42501'; end if;
  actor:=current_setting('app.current_profile_id')::uuid; dataset:=current_setting('app.current_run_id')::uuid;
  if expected_revision is null or expected_revision<0 or expected_revision>=2147483647
    or (requested_card is null)<>(requested_hero is null) then raise exception 'event banner invalid' using errcode='22023'; end if;
  perform app.group_session_flags(true);
  perform app.group_lock_coach(dataset,actor,false);
  perform pg_advisory_xact_lock(hashtextextended('event-banner:'||actor::text,356));
  select * into activity from app.coach_group_sessions g where g.id=requested_id and g.run_id=dataset and g.coach_profile_id=actor for update;
  if not found then raise exception 'event banner forbidden' using errcode='42501'; end if;
  if not (activity.status='draft' or (activity.status in ('open','confirmed') and activity.starts_at>clock_timestamp()
    and (activity.status='confirmed' or activity.decision_deadline_at>clock_timestamp()))) then raise exception 'event banner changed' using errcode='P0001'; end if;
  insert into app.group_session_banners(run_id,session_id,coach_profile_id) values(dataset,requested_id,actor) on conflict do nothing;
  select * into strict previous from app.group_session_banners b where b.session_id=requested_id for update;
  if previous.run_id<>dataset or previous.coach_profile_id<>actor then raise exception 'event banner forbidden' using errcode='42501'; end if;
  if previous.revision<>expected_revision then raise exception 'event banner changed' using errcode='P0001'; end if;
  if requested_card is not null then
    if requested_card=requested_hero or split_part(requested_card,'/',1)<>actor::text or split_part(requested_hero,'/',1)<>actor::text
      or requested_card in (previous.card_path,previous.hero_path) or requested_hero in (previous.card_path,previous.hero_path)
      or not app.event_banner_object_exists(requested_card,393216)
      or not app.event_banner_object_exists(requested_hero,1048576)
    then raise exception 'event banner invalid' using errcode='22023'; end if;
  end if;
  return query update app.group_session_banners b set revision=b.revision+1,card_path=requested_card,hero_path=requested_hero,updated_at=statement_timestamp()
    where b.session_id=requested_id returning previous.card_path,previous.hero_path,b.revision,b.card_path,b.hero_path;
  perform app.group_session_flags(false);
end $$;
alter function app.mutate_owned_group_session_banner(uuid,integer,text,text) owner to app_owner;
revoke all on function app.mutate_owned_group_session_banner(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function app.mutate_owned_group_session_banner(uuid,integer,text,text) to app_runtime;

-- Public eligibility is identical to public group detail, plus active/public dataset.
create function app.group_banner_is_public(requested_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.coach_group_sessions g join app.demo_runs r on r.id=g.run_id
    where g.id=requested_session and g.status<>'draft' and r.status='active' and r.catalogue_visibility='public'
      and app.group_coach_enabled(g.run_id,g.coach_profile_id,true))
$$;
alter function app.group_banner_is_public(uuid) owner to postgres;
revoke all on function app.group_banner_is_public(uuid) from public,anon,authenticated;
grant execute on function app.group_banner_is_public(uuid) to app_owner,app_runtime;

create function app.public_group_event_media(requested_sessions uuid[])
returns table(session_id uuid,coach_profile_id uuid,coach_slug text,portrait_source text,portrait_path text,portrait_updated_at timestamptz,
  event_revision integer,event_card_path text,event_hero_path text,coach_revision integer,coach_card_path text)
language plpgsql stable security definer set search_path='' as $$
begin
  if requested_sessions is null or cardinality(requested_sessions)>100 then raise exception 'event media batch invalid' using errcode='22023'; end if;
  return query select g.id,c.profile_id,c.public_slug,c.portrait_source,c.portrait_path,c.portrait_updated_at,
    coalesce(b.revision,0),b.card_path,b.hero_path,coalesce(w.revision,0),
    case when app.coach_website_is_public(c.run_id,c.profile_id) then w.card_path else null end
    from app.coach_group_sessions g join app.coach_profiles c on c.run_id=g.run_id and c.profile_id=g.coach_profile_id
    left join app.group_session_banners b on b.session_id=g.id
    left join app.coach_website_content w on w.run_id=c.run_id and w.profile_id=c.profile_id
    where g.id=any(requested_sessions) and app.group_banner_is_public(g.id) order by g.id limit 100;
end $$;
alter function app.public_group_event_media(uuid[]) owner to postgres;
revoke all on function app.public_group_event_media(uuid[]) from public,anon,authenticated;
grant execute on function app.public_group_event_media(uuid[]) to app_runtime;

create function app.current_storage_event_owner() returns uuid
language sql stable security definer set search_path='' as $$
  select p.id from app.profiles p join app.coach_profiles c on c.profile_id=p.id
    join app.demo_runs r on r.id=c.run_id
    join app.demo_run_participants participant on participant.run_id=c.run_id and participant.profile_id=p.id
  where p.auth_user_id=(select auth.uid()) and p.claimed_at is not null and participant.status='active'
    and r.status='active' and r.catalogue_visibility='public' and app.group_coach_enabled(c.run_id,c.profile_id,false) limit 1
$$;
alter function app.current_storage_event_owner() owner to postgres;
revoke all on function app.current_storage_event_owner() from public,anon;
grant execute on function app.current_storage_event_owner() to authenticated;

create function app.can_read_public_event_banner(requested_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.group_session_banners b where requested_path in (b.card_path,b.hero_path) and app.group_banner_is_public(b.session_id))
$$;
alter function app.can_read_public_event_banner(text) owner to postgres;
revoke all on function app.can_read_public_event_banner(text) from public;
grant execute on function app.can_read_public_event_banner(text) to anon,authenticated;

create function app.can_delete_owned_event_banner(requested_path text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare owner_profile uuid;
begin
  owner_profile:=app.current_storage_event_owner();
  if owner_profile is null or split_part(requested_path,'/',1)<>owner_profile::text then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('event-banner:'||owner_profile::text,356));
  return not exists(select 1 from app.group_session_banners b where requested_path in (b.card_path,b.hero_path));
end $$;
alter function app.can_delete_owned_event_banner(text) owner to postgres;
revoke all on function app.can_delete_owned_event_banner(text) from public,anon;
grant execute on function app.can_delete_owned_event_banner(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-banners','event-banners',false,1048576,array['image/webp']);
create policy event_banners_owner_insert on storage.objects for insert to authenticated with check(
  bucket_id='event-banners' and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
  and split_part(name,'/',1)=(select app.current_storage_event_owner())::text);
create policy event_banners_owner_select on storage.objects for select to authenticated using(
  bucket_id='event-banners' and split_part(name,'/',1)=(select app.current_storage_event_owner())::text);
create policy event_banners_public_current_select on storage.objects for select to anon,authenticated using(
  bucket_id='event-banners' and app.can_read_public_event_banner(name));
create policy event_banners_owner_delete on storage.objects for delete to authenticated using(
  bucket_id='event-banners' and app.can_delete_owned_event_banner(name));
