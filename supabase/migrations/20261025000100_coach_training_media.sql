-- MOV-19: separate draft/published media; no retained-account backfill.
do $$ begin
  if not exists(select from pg_roles where rolname='app_media_worker') then
    create role app_media_worker nologin nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
grant usage on schema app to app_media_worker;

create table app.coach_media_sets (
  run_id uuid not null,
  profile_id uuid not null,
  revision integer not null default 0 check(revision>=0),
  draft_photos uuid[] not null default '{}',
  published_photos uuid[] not null default '{}',
  draft_video uuid,
  published_video uuid,
  primary key(run_id,profile_id),
  foreign key(run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade,
  check(cardinality(draft_photos)<=6 and cardinality(published_photos)<=6)
);
create table app.coach_media_assets (
  id uuid primary key,
  run_id uuid not null,
  profile_id uuid not null,
  kind text not null check(kind in ('photo','video')),
  status text not null default 'reserved' check(status in ('reserved','creating','uploading','processing','ready','failed','retired','deleted')),
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
  description text not null check(app.valid_coach_website_text(description,160) and btrim(description)<>''),
  replace_id uuid,
  thumbnail_path text,
  full_path text,
  width integer check(width between 1 and 1600),
  height integer check(height between 1 and 1600),
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  upload_url text,
  duration numeric,
  error text check(char_length(error)<=240),
  external_claimed boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '1 hour',
  foreign key(run_id,profile_id) references app.coach_media_sets(run_id,profile_id) on delete cascade,
  check((kind='photo' and thumbnail_path is not null and full_path is not null and thumbnail_path<>full_path
    and thumbnail_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$' and full_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
    and split_part(thumbnail_path,'/',1)=profile_id::text and split_part(full_path,'/',1)=profile_id::text)
    or (kind='video' and thumbnail_path is null and full_path is null)),
  check(kind<>'video' or status<>'ready' or (duration is not null and duration>0 and duration<=60 and mux_playback_id is not null and mux_playback_id ~ '^[a-zA-Z0-9]{8,128}$' and mux_asset_id is not null)),
  check(kind<>'photo' or status<>'ready' or (width is not null and height is not null))
);
create index coach_media_assets_owner on app.coach_media_assets(run_id,profile_id,created_at);
create unique index coach_media_one_pending_video on app.coach_media_assets(run_id,profile_id)
  where kind='video' and status in ('reserved','creating','uploading','processing');
create unique index coach_media_one_pending_replacement on app.coach_media_assets(run_id,profile_id,replace_id)
  where kind='photo' and replace_id is not null and status in ('reserved','creating');

alter table app.coach_media_sets owner to app_owner;
alter table app.coach_media_assets owner to app_owner;
alter table app.coach_media_sets enable row level security;
alter table app.coach_media_sets force row level security;
alter table app.coach_media_assets enable row level security;
alter table app.coach_media_assets force row level security;
revoke all on app.coach_media_sets,app.coach_media_assets from public,anon,authenticated,app_runtime,app_media_worker;
create policy coach_media_sets_internal on app.coach_media_sets to app_owner using(true) with check(true);
create policy coach_media_assets_internal on app.coach_media_assets to app_owner using(true) with check(true);

-- Same validated actor as the application, including active dataset membership.
create function app.coach_media_actor() returns table(run_id uuid,profile_id uuid,approved boolean)
language sql stable security definer set search_path='' as $$
  select c.run_id,c.profile_id,(c.is_demo or a.status='approved')
  from app.coach_profiles c left join app.coach_applications a on a.profile_id=c.profile_id
  where app.authorized_actor_context_valid(c.profile_id,c.run_id,null)
    and (c.is_demo or a.status in ('pending','approved','rejected'))
$$;
alter function app.coach_media_actor() owner to postgres;
revoke all on function app.coach_media_actor() from public,anon,authenticated,app_runtime,app_media_worker;
grant execute on function app.coach_media_actor() to app_owner;

create function app.coach_media_snapshot(requested_run uuid,requested_profile uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('revision',coalesce(s.revision,0),
    'photos',coalesce((select jsonb_agg(to_jsonb(a) order by o.n) from unnest(s.draft_photos) with ordinality o(id,n) join app.coach_media_assets a on a.id=o.id),'[]'::jsonb),
    'publishedPhotos',coalesce((select jsonb_agg(to_jsonb(a) order by o.n) from unnest(s.published_photos) with ordinality o(id,n) join app.coach_media_assets a on a.id=o.id),'[]'::jsonb),
    'video',(select to_jsonb(a) from app.coach_media_assets a where a.id=s.draft_video),
    'publishedVideo',(select to_jsonb(a) from app.coach_media_assets a where a.id=s.published_video),
    'uploads',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from (select * from app.coach_media_assets a
      where a.run_id=requested_run and a.profile_id=requested_profile and a.status in ('reserved','creating','uploading','processing','failed') order by created_at limit 20) a),'[]'::jsonb),
    'cleanup',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from (select * from app.coach_media_assets a
      where a.run_id=requested_run and a.profile_id=requested_profile and a.status in ('retired','failed')
      and not(a.id=any(s.draft_photos||s.published_photos)) and a.id is distinct from s.draft_video and a.id is distinct from s.published_video
      order by created_at limit 20) a),'[]'::jsonb))
  from (select requested_run run_id,requested_profile profile_id) owner
  left join app.coach_media_sets s using(run_id,profile_id)
$$;
alter function app.coach_media_snapshot(uuid,uuid) owner to app_owner;
revoke all on function app.coach_media_snapshot(uuid,uuid) from public,anon,authenticated,app_runtime,app_media_worker;

create function app.owned_coach_media() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor record;
begin
  select * into actor from app.coach_media_actor();
  if actor.profile_id is null then raise exception 'coach media forbidden' using errcode='42501'; end if;
  return app.coach_media_snapshot(actor.run_id,actor.profile_id)||jsonb_build_object('canPublish',actor.approved);
end $$;
alter function app.owned_coach_media() owner to app_owner;
revoke all on function app.owned_coach_media() from public,anon,authenticated,app_media_worker;
grant execute on function app.owned_coach_media() to app_runtime;

-- Application owner must not gain direct access to the Storage schema.
create function app.coach_media_photo_object_exists(requested_path text,maximum_bytes bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from storage.objects o where o.bucket_id='coach-gallery' and o.name=requested_path
    and o.metadata->>'mimetype'='image/webp' and (o.metadata->>'size')::bigint between 1 and maximum_bytes)
$$;
alter function app.coach_media_photo_object_exists(text,bigint) owner to postgres;
revoke all on function app.coach_media_photo_object_exists(text,bigint) from public,anon,authenticated,app_runtime,app_media_worker;
grant execute on function app.coach_media_photo_object_exists(text,bigint) to app_owner;

create function app.mutate_owned_coach_media(expected_revision integer,action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor record; current_set app.coach_media_sets%rowtype; asset app.coach_media_assets%rowtype;
  requested_id uuid; replacements uuid[]; already_exists boolean; claimed boolean:=false;
begin
  select * into actor from app.coach_media_actor();
  if actor.profile_id is null then raise exception 'coach media forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.profile_id::text,2907));
  if expected_revision is null or expected_revision<0 or expected_revision>=2147483647 or jsonb_typeof(input)<>'object' then raise exception 'coach media invalid' using errcode='22023'; end if;
  insert into app.coach_media_sets(run_id,profile_id) values(actor.run_id,actor.profile_id) on conflict do nothing;
  select * into strict current_set from app.coach_media_sets s where s.run_id=actor.run_id and s.profile_id=actor.profile_id for update;
  requested_id:=(input->>'id')::uuid;
  if requested_id is not null then
    select * into asset from app.coach_media_assets a where a.id=requested_id and a.run_id=actor.run_id and a.profile_id=actor.profile_id for update;
  end if;
  if action='reserve' then
    if exists(select from app.coach_media_assets a where a.id=requested_id) then
      if asset.id is null or asset.fingerprint is distinct from input->>'fingerprint' or asset.description is distinct from input->>'description'
        or asset.kind is distinct from input->>'kind' or asset.replace_id is distinct from (input->>'replaceId')::uuid then
        raise exception 'coach media altered retry' using errcode='22023';
      end if;
      return app.owned_coach_media();
    end if;
  end if;
  -- A recovered exact completion must not consume another revision.
  if action='finish-photo' and requested_id=any(current_set.draft_photos) and asset.status='ready' then return app.owned_coach_media(); end if;
  if action in ('reserve','finish-photo','remove-photo','remove-video','reorder','publish','discard') and current_set.revision<>expected_revision then
    raise exception 'coach media revision conflict' using errcode='P0001';
  end if;
  if action='reserve' then
    update app.coach_media_assets a set status='retired',upload_url=null where a.run_id=actor.run_id and a.profile_id=actor.profile_id
      and a.status in ('reserved','creating','uploading','processing') and a.expires_at<clock_timestamp();
    if input->>'kind'='video' then
      if not actor.approved then raise exception 'coach media video forbidden' using errcode='42501'; end if;
      if exists(select from app.coach_media_assets a where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.kind='video' and a.status in ('reserved','creating','uploading','processing'))
        or (select count(*) from app.coach_media_assets a where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.kind='video' and a.created_at>clock_timestamp()-interval '1 hour')>=4 then
        raise exception 'coach media upload limit' using errcode='P0001';
      end if;
    elsif input->>'kind'='photo' then
      if input->>'replaceId' is null then
        if cardinality(current_set.draft_photos)+(select count(*) from app.coach_media_assets a where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.kind='photo' and a.replace_id is null and a.status in ('reserved','creating'))>=6 then
          raise exception 'coach media photo limit' using errcode='P0001';
        end if;
      elsif not ((input->>'replaceId')::uuid=any(current_set.draft_photos)) then raise exception 'coach media replacement conflict' using errcode='P0001'; end if;
    else raise exception 'coach media invalid kind' using errcode='22023'; end if;
    insert into app.coach_media_assets(id,run_id,profile_id,kind,fingerprint,description,replace_id,thumbnail_path,full_path,width,height)
    values(requested_id,actor.run_id,actor.profile_id,input->>'kind',input->>'fingerprint',input->>'description',(input->>'replaceId')::uuid,
      case when input->>'kind'='photo' then actor.profile_id::text||'/'||gen_random_uuid()::text||'.webp' end,
      case when input->>'kind'='photo' then actor.profile_id::text||'/'||gen_random_uuid()::text||'.webp' end,
      (input->>'width')::integer,(input->>'height')::integer);
  elsif action='claim' then
    if asset.id is null then raise exception 'coach media upload missing' using errcode='42501'; end if;
    if asset.kind='video' and not actor.approved then raise exception 'coach media video forbidden' using errcode='42501'; end if;
    update app.coach_media_assets set status='creating',external_claimed=true where id=asset.id and status='reserved' and expires_at>clock_timestamp();
    claimed:=found;
  elsif action='set-upload' then
    if asset.id is null or asset.kind<>'video' or not actor.approved then raise exception 'coach media video forbidden' using errcode='42501'; end if;
    if asset.status<>'creating' then raise exception 'coach media upload conflict' using errcode='P0001'; end if;
    if input->>'uploadId' is null or input->>'uploadUrl' is null or input->>'uploadId' !~ '^[a-zA-Z0-9]{8,128}$' or input->>'uploadUrl' !~ '^https://(storage[.]googleapis[.]com|direct-uploads-[a-z0-9-]+[.]mux[.]com)/[A-Za-z0-9._~!$&''()*+,;=:@%/?-]+$' or char_length(input->>'uploadUrl')>8192 then raise exception 'coach media upload invalid' using errcode='22023'; end if;
    update app.coach_media_assets set status='uploading',mux_upload_id=input->>'uploadId',upload_url=input->>'uploadUrl' where id=asset.id;
  elsif action='finish-photo' then
    if asset.id is null or asset.kind<>'photo' or asset.status not in ('creating','reserved') or asset.expires_at<=clock_timestamp() then raise exception 'coach media photo missing' using errcode='42501'; end if;
    if not app.coach_media_photo_object_exists(asset.thumbnail_path,262144)
      or not app.coach_media_photo_object_exists(asset.full_path,1048576) then
      raise exception 'coach media photo incomplete' using errcode='P0001';
    end if;
    if asset.replace_id is null then
      if cardinality(current_set.draft_photos)>=6 then raise exception 'coach media photo limit' using errcode='P0001'; end if;
      replacements:=array_append(current_set.draft_photos,asset.id);
    else
      if not(asset.replace_id=any(current_set.draft_photos)) then raise exception 'coach media replacement conflict' using errcode='P0001'; end if;
      replacements:=array_replace(current_set.draft_photos,asset.replace_id,asset.id);
    end if;
    update app.coach_media_assets set status='ready' where id=asset.id;
    update app.coach_media_sets s set draft_photos=replacements,revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
  elsif action='reorder' then
    if jsonb_typeof(input->'ids')<>'array' then raise exception 'coach media order invalid' using errcode='22023'; end if;
    select coalesce(array_agg(x::uuid),'{}'::uuid[]) into replacements from jsonb_array_elements_text(input->'ids') x;
    if cardinality(replacements)<>cardinality(current_set.draft_photos) or not(replacements @> current_set.draft_photos and replacements <@ current_set.draft_photos)
      or cardinality(replacements)<>(select count(distinct x) from unnest(replacements) x) then raise exception 'coach media order invalid' using errcode='22023'; end if;
    update app.coach_media_sets s set draft_photos=replacements,revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
  elsif action='remove-photo' then
    if asset.id is null or asset.kind<>'photo' then raise exception 'coach media photo forbidden' using errcode='42501'; end if;
    if requested_id=any(current_set.draft_photos) then
      update app.coach_media_sets s set draft_photos=array_remove(s.draft_photos,requested_id),revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
    end if;
  elsif action='remove-video' then
    update app.coach_media_sets s set draft_video=null,revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id and s.draft_video is not null;
  elsif action='cancel' then
    if asset.id is null or asset.id=any(current_set.draft_photos||current_set.published_photos) or asset.id is not distinct from current_set.draft_video or asset.id is not distinct from current_set.published_video then
      raise exception 'coach media cancel forbidden' using errcode='42501';
    end if;
    update app.coach_media_assets set status='retired',upload_url=null where id=asset.id and status<>'deleted';
  elsif action='publish' then
    if not actor.approved then raise exception 'coach media publication forbidden' using errcode='42501'; end if;
    if exists(select from app.coach_media_assets a where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.status in ('reserved','creating','uploading','processing')) then raise exception 'coach media upload unfinished' using errcode='P0001'; end if;
    update app.coach_media_sets s set published_photos=s.draft_photos,published_video=s.draft_video,revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
  elsif action='discard' then
    update app.coach_media_sets s set draft_photos=s.published_photos,draft_video=s.published_video,revision=s.revision+1 where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
    update app.coach_media_assets a set status='retired',upload_url=null where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.status in ('reserved','creating','uploading','processing');
  elsif action='deleted' then
    if asset.id is null or asset.status not in ('failed','retired') then raise exception 'coach media cleanup forbidden' using errcode='42501'; end if;
    if asset.kind='video' and asset.external_claimed and asset.mux_upload_id is null and asset.mux_asset_id is null then
      raise exception 'coach media provider outcome unknown' using errcode='P0001';
    end if;
    update app.coach_media_assets set status='deleted',upload_url=null where id=asset.id;
  else raise exception 'coach media command invalid' using errcode='22023'; end if;
  select * into strict current_set from app.coach_media_sets s where s.run_id=actor.run_id and s.profile_id=actor.profile_id;
  update app.coach_media_assets a set status='retired',upload_url=null where a.run_id=actor.run_id and a.profile_id=actor.profile_id and a.status='ready'
    and not(a.id=any(current_set.draft_photos||current_set.published_photos)) and a.id is distinct from current_set.draft_video and a.id is distinct from current_set.published_video;
  return app.owned_coach_media()||jsonb_build_object('claimed',claimed);
end $$;
alter function app.mutate_owned_coach_media(integer,text,jsonb) owner to app_owner;
revoke all on function app.mutate_owned_coach_media(integer,text,jsonb) from public,anon,authenticated,app_media_worker;
grant execute on function app.mutate_owned_coach_media(integer,text,jsonb) to app_runtime;

create function app.public_coach_media(requested_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('profileId',c.profile_id,'photos',
    coalesce((select jsonb_agg(to_jsonb(a) order by o.n) from unnest(s.published_photos) with ordinality o(id,n) join app.coach_media_assets a on a.id=o.id and a.status='ready'),'[]'::jsonb),
    'video',(select to_jsonb(a) from app.coach_media_assets a where a.id=s.published_video and a.status='ready'))
  from app.coach_profiles c left join app.coach_media_sets s on s.run_id=c.run_id and s.profile_id=c.profile_id
  where c.public_slug=requested_slug and app.coach_website_is_public(c.run_id,c.profile_id)
$$;
alter function app.public_coach_media(text) owner to postgres;
revoke all on function app.public_coach_media(text) from public,anon,authenticated,app_media_worker;
grant execute on function app.public_coach_media(text) to app_runtime;

-- Only the dedicated callback connection may assert provider readiness.
create function app.apply_coach_media_video(requested_id uuid,upload_id text,asset_id text,playback_id text,requested_status text,seconds numeric) returns boolean
language plpgsql security definer set search_path='' as $$
declare asset app.coach_media_assets%rowtype;
begin
  select * into asset from app.coach_media_assets a where a.id=requested_id and a.kind='video';
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(asset.profile_id::text,2907));
  select * into strict asset from app.coach_media_assets a where a.id=requested_id for update;
  if asset.mux_upload_id is distinct from upload_id or asset.status='deleted' then return false; end if;
  if asset_id is null or asset_id !~ '^[a-zA-Z0-9]{8,128}$' or (asset.mux_asset_id is not null and asset.mux_asset_id<>asset_id) then raise exception 'coach media provider identity invalid' using errcode='22023'; end if;
  if asset.status in ('retired','failed') then
    -- Keep the verified identity even when cancellation won the race. A repeated
    -- callback can DELETE this exact asset without GET-ing a deleted asset.
    update app.coach_media_assets set mux_asset_id=asset_id where id=asset.id and mux_asset_id is null;
    return false;
  end if;
  if asset.status='ready' then return true; end if;
  if requested_status='ready' and seconds>0 and seconds<=60 and playback_id ~ '^[a-zA-Z0-9]{8,128}$' then
    update app.coach_media_assets set status='ready',mux_asset_id=asset_id,mux_playback_id=playback_id,duration=seconds,upload_url=null,error=null where id=asset.id;
    update app.coach_media_sets s set draft_video=asset.id,revision=s.revision+1 where s.run_id=asset.run_id and s.profile_id=asset.profile_id;
  elsif requested_status='failed' or (requested_status='ready' and (seconds is null or seconds<=0 or seconds>60)) then
    update app.coach_media_assets set status='failed',mux_asset_id=asset_id,upload_url=null,error=case when seconds>60 then 'Choose a video of 60 seconds or less.' else 'Video processing failed. Choose another video.' end where id=asset.id;
  elsif requested_status='processing' then
    update app.coach_media_assets set status='processing',mux_asset_id=asset_id where id=asset.id;
  else raise exception 'coach media provider state invalid' using errcode='22023'; end if;
  -- A prior unpublished ready replacement is no longer referenced.
  update app.coach_media_assets a set status='retired',upload_url=null from app.coach_media_sets s
    where s.run_id=asset.run_id and s.profile_id=asset.profile_id and a.run_id=s.run_id and a.profile_id=s.profile_id and a.kind='video' and a.status='ready'
    and a.id is distinct from s.draft_video and a.id is distinct from s.published_video;
  return true;
end $$;
alter function app.apply_coach_media_video(uuid,text,text,text,text,numeric) owner to app_owner;
revoke all on function app.apply_coach_media_video(uuid,text,text,text,text,numeric) from public,anon,authenticated,app_runtime;
grant execute on function app.apply_coach_media_video(uuid,text,text,text,text,numeric) to app_media_worker;

create function app.coach_media_worker_asset(requested_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select to_jsonb(a) from app.coach_media_assets a where a.id=requested_id and a.kind='video'
$$;
alter function app.coach_media_worker_asset(uuid) owner to app_owner;
revoke all on function app.coach_media_worker_asset(uuid) from public,anon,authenticated,app_runtime;
grant execute on function app.coach_media_worker_asset(uuid) to app_media_worker;

create function app.coach_media_object_access(requested_path text,operation text) returns boolean
language sql volatile security definer set search_path='' as $$
  select exists(select from app.coach_media_assets a join app.coach_media_sets s using(run_id,profile_id)
    where requested_path in (a.thumbnail_path,a.full_path) and a.kind='photo' and
      case operation
      when 'insert' then a.profile_id=app.current_storage_website_owner() and a.status='creating' and a.expires_at>clock_timestamp()
      when 'owner' then a.profile_id=app.current_storage_website_owner()
      when 'public' then a.status='ready' and a.id=any(s.published_photos) and app.coach_website_is_public(a.run_id,a.profile_id)
      when 'delete' then a.profile_id=app.current_storage_website_owner() and a.status in ('retired','failed') and not(a.id=any(s.draft_photos||s.published_photos))
      else false end)
$$;
alter function app.coach_media_object_access(text,text) owner to postgres;
revoke all on function app.coach_media_object_access(text,text) from public;
grant execute on function app.coach_media_object_access(text,text) to anon,authenticated,app_owner;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('coach-gallery','coach-gallery',false,1048576,array['image/webp']);
create policy coach_gallery_insert on storage.objects for insert to authenticated with check(bucket_id='coach-gallery' and app.coach_media_object_access(name,'insert'));
create policy coach_gallery_owner_read on storage.objects for select to authenticated using(bucket_id='coach-gallery' and app.coach_media_object_access(name,'owner'));
create policy coach_gallery_public_read on storage.objects for select to anon,authenticated using(bucket_id='coach-gallery' and app.coach_media_object_access(name,'public'));
create policy coach_gallery_delete on storage.objects for delete to authenticated using(bucket_id='coach-gallery' and app.coach_media_object_access(name,'delete'));

create function app.lock_coach_gallery_object() returns trigger language plpgsql security definer set search_path='' as $$
declare path text; bucket text;
begin
  path:=case when tg_op='DELETE' then old.name else new.name end;
  bucket:=case when tg_op='DELETE' then old.bucket_id else new.bucket_id end;
  if bucket='coach-gallery' then
    perform pg_advisory_xact_lock(hashtextextended(split_part(path,'/',1),2907));
    if tg_op='DELETE' and exists(select from app.coach_media_assets a join app.coach_media_sets s using(run_id,profile_id)
      where path in (a.thumbnail_path,a.full_path) and a.id=any(s.draft_photos||s.published_photos)) then
      raise exception 'coach media current object cannot be deleted' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
alter function app.lock_coach_gallery_object() owner to postgres;
revoke all on function app.lock_coach_gallery_object() from public;
create trigger coach_gallery_object_lock before insert or update or delete on storage.objects for each row execute function app.lock_coach_gallery_object();
