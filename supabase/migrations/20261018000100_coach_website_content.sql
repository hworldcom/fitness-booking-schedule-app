-- DEV0321: optional website content and private, revocable banner variants.
create function app.valid_coach_website_text(value text, maximum integer, multiline boolean default false)
returns boolean language sql immutable set search_path='' as $$
  select value is not null and char_length(value)<=maximum
    and value !~ '[<>\u0001-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
    and (multiline or value !~ '[\n\t]')
$$;
alter function app.valid_coach_website_text(text,integer,boolean) owner to app_owner;

create function app.valid_coach_website_content(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; key text;
begin
  if value is null or jsonb_typeof(value)<>'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(value))<>7 then return false; end if;
  for key in select jsonb_object_keys(value) loop
    if key not in ('brandLabel','introduction','approach','experience','focusLabels','faqs','links') then return false; end if;
  end loop;
  for key in select unnest(array['brandLabel','introduction','approach','experience']) loop
    if jsonb_typeof(value->key)<>'string' or not app.valid_coach_website_text(value->>key,
      case key when 'brandLabel' then 80 when 'introduction' then 220 else 2000 end,
      key in ('approach','experience')) then return false; end if;
  end loop;
  if jsonb_typeof(value->'focusLabels')<>'array' or jsonb_typeof(value->'faqs')<>'array' or jsonb_typeof(value->'links')<>'array' then return false; end if;
  if jsonb_array_length(value->'focusLabels')>8 or jsonb_array_length(value->'faqs')>6 or jsonb_array_length(value->'links')>4 then return false; end if;
  for item in select * from jsonb_array_elements(value->'focusLabels') loop
    if jsonb_typeof(item)<>'string' or not app.valid_coach_website_text(item#>>'{}',60) or btrim(item#>>'{}')='' then return false; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(value->'focusLabels')) <>
     (select count(distinct x) from jsonb_array_elements(value->'focusLabels') x) then return false; end if;
  for item in select * from jsonb_array_elements(value->'faqs') loop
    if jsonb_typeof(item)<>'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['question','answer']
      or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
      or not app.valid_coach_website_text(item->>'question',160) or btrim(item->>'question')=''
      or not app.valid_coach_website_text(item->>'answer',1000,true) or btrim(item->>'answer')='' then return false; end if;
  end loop;
  for item in select * from jsonb_array_elements(value->'links') loop
    if jsonb_typeof(item)<>'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['label','url']
      or jsonb_typeof(item->'label')<>'string' or jsonb_typeof(item->'url')<>'string'
      or not app.valid_coach_website_text(item->>'label',60) or btrim(item->>'label')=''
      or char_length(item->>'url')>2048 or (item->>'url') !~ '^https://[^/?#@[:space:]\\]+[.][^/?#@[:space:]\\]+([/?#][^[:space:]\\]*)?$'
      then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
alter function app.valid_coach_website_content(jsonb) owner to app_owner;

create table app.coach_website_content (
  run_id uuid not null,
  profile_id uuid not null,
  revision integer not null default 0 check(revision>=0),
  content jsonb not null default '{"brandLabel":"","introduction":"","approach":"","experience":"","focusLabels":[],"faqs":[],"links":[]}'::jsonb,
  card_path text,
  hero_path text,
  updated_at timestamptz not null default statement_timestamp(),
  primary key(run_id,profile_id),
  foreign key(run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade,
  constraint coach_website_content_valid check(app.valid_coach_website_content(content)),
  constraint coach_website_banner_valid check(
    (card_path is null and hero_path is null) or
    (card_path is not null and hero_path is not null and card_path<>hero_path
      and card_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      and hero_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      and split_part(card_path,'/',1)=profile_id::text and split_part(hero_path,'/',1)=profile_id::text))
);
alter table app.coach_website_content owner to app_owner;
alter table app.coach_website_content enable row level security;
alter table app.coach_website_content force row level security;
revoke all on app.coach_website_content from public,anon,authenticated,app_runtime;
grant select on app.coach_website_content to app_runtime;
create policy coach_website_internal on app.coach_website_content to app_owner using(true) with check(true);
create policy coach_website_owner on app.coach_website_content for select to app_runtime
  using(app.authorized_actor_context_valid(profile_id,run_id,null));

-- Boolean-only Storage policy helpers intentionally cross application RLS as
-- postgres, like the existing Storage identity helpers. No caller supplies an actor.
create function app.coach_website_is_public(requested_run uuid,requested_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.coach_profiles c join app.demo_runs r on r.id=c.run_id
    where c.run_id=requested_run and c.profile_id=requested_profile and c.visibility='visible'
      and r.status='active' and r.catalogue_visibility='public'
      and app.coach_trust_kind(c.profile_id,c.is_demo) is not null
      and app.coach_has_publishable_primary_location(c.run_id,c.profile_id))
$$;
alter function app.coach_website_is_public(uuid,uuid) owner to postgres;
revoke all on function app.coach_website_is_public(uuid,uuid) from public,anon,authenticated;
grant execute on function app.coach_website_is_public(uuid,uuid) to app_owner,app_runtime;

create function app.current_storage_website_owner() returns uuid
language sql stable security definer set search_path='' as $$
  select p.id from app.profiles p join app.coach_profiles c on c.profile_id=p.id
    join app.demo_runs r on r.id=c.run_id
    join app.demo_run_participants participant on participant.run_id=c.run_id and participant.profile_id=p.id
    left join app.coach_applications a on a.profile_id=p.id
  where p.auth_user_id=(select auth.uid()) and p.claimed_at is not null
    and r.status='active' and r.catalogue_visibility='public' and participant.status='active'
    and (c.is_demo or a.status in ('pending','approved','rejected')) limit 1
$$;
alter function app.current_storage_website_owner() owner to postgres;
revoke all on function app.current_storage_website_owner() from public,anon;
grant execute on function app.current_storage_website_owner() to authenticated;

create function app.storage_website_banner_is_current(requested_path text, public_only boolean) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.coach_website_content w
    where requested_path in (w.card_path,w.hero_path)
      and (not public_only or app.coach_website_is_public(w.run_id,w.profile_id)))
$$;
alter function app.storage_website_banner_is_current(text,boolean) owner to postgres;
revoke all on function app.storage_website_banner_is_current(text,boolean) from public;
grant execute on function app.storage_website_banner_is_current(text,boolean) to anon,authenticated;

create function app.coach_website_banner_object_exists(requested_path text,maximum_bytes bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from storage.objects o where o.bucket_id='coach-banners' and o.name=requested_path
    and o.metadata->>'mimetype'='image/webp' and (o.metadata->>'size')::bigint between 1 and maximum_bytes)
$$;
alter function app.coach_website_banner_object_exists(text,bigint) owner to postgres;
revoke all on function app.coach_website_banner_object_exists(text,bigint) from public,anon,authenticated;
grant execute on function app.coach_website_banner_object_exists(text,bigint) to app_owner;

create function app.mutate_owned_coach_website(expected_revision integer,requested_content jsonb,
  requested_card text,requested_hero text,banner_change boolean)
returns table(previous_card_path text,previous_hero_path text,revision integer,content jsonb,card_path text,hero_path text)
language plpgsql security definer set search_path='' as $$
declare actor_profile uuid; actor_run uuid; selected_coach app.coach_profiles%rowtype;
  selected_website app.coach_website_content%rowtype; application_status text;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'coach website actor invalid' using errcode='42501'; end if;
  actor_profile:=current_setting('app.current_profile_id')::uuid; actor_run:=current_setting('app.current_run_id')::uuid;
  perform set_config('app.coach_profile_management','on',true);
  perform set_config('app.coach_application_management','on',true);
  select c.* into selected_coach from app.coach_profiles c where c.run_id=actor_run and c.profile_id=actor_profile for update;
  if not found then raise exception 'coach website forbidden' using errcode='42501'; end if;
  select a.status into application_status from app.coach_applications a where a.profile_id=actor_profile for share;
  if not selected_coach.is_demo and coalesce(application_status,'') not in ('pending','approved','rejected') then
    raise exception 'coach website forbidden' using errcode='42501'; end if;
  if expected_revision is null or expected_revision<0 or expected_revision>=2147483647 or banner_change is null
    or (requested_content is null and not banner_change)
    or (requested_content is not null and not app.valid_coach_website_content(requested_content))
    or (not banner_change and (requested_card is not null or requested_hero is not null)) then
    raise exception 'coach website invalid' using errcode='22023'; end if;
  insert into app.coach_website_content(run_id,profile_id) values(actor_run,actor_profile) on conflict do nothing;
  select w.* into strict selected_website from app.coach_website_content w where w.run_id=actor_run and w.profile_id=actor_profile for update;
  if selected_website.revision<>expected_revision then raise exception 'coach website revision conflict' using errcode='P0001'; end if;
  if banner_change and requested_card is not null then
    if requested_hero is null or requested_card=requested_hero or split_part(requested_card,'/',1)<>actor_profile::text or split_part(requested_hero,'/',1)<>actor_profile::text
      or requested_card in (selected_website.card_path,selected_website.hero_path) or requested_hero in (selected_website.card_path,selected_website.hero_path)
      or not app.coach_website_banner_object_exists(requested_card,393216)
      or not app.coach_website_banner_object_exists(requested_hero,1048576)
    then raise exception 'coach website banner invalid' using errcode='22023'; end if;
  elsif banner_change and requested_hero is not null then raise exception 'coach website banner invalid' using errcode='22023'; end if;
  previous_card_path:=selected_website.card_path; previous_hero_path:=selected_website.hero_path;
  return query update app.coach_website_content w set
    content=coalesce(requested_content,w.content),
    card_path=case when banner_change then requested_card else w.card_path end,
    hero_path=case when banner_change then requested_hero else w.hero_path end,
    revision=w.revision+1,updated_at=clock_timestamp()
    where w.run_id=actor_run and w.profile_id=actor_profile
    returning previous_card_path,previous_hero_path,w.revision,w.content,w.card_path,w.hero_path;
  perform set_config('app.coach_profile_management','off',true);
  perform set_config('app.coach_application_management','off',true);
exception when others then
  perform set_config('app.coach_profile_management','off',true);
  perform set_config('app.coach_application_management','off',true);
  raise;
end;
$$;
alter function app.mutate_owned_coach_website(integer,jsonb,text,text,boolean) owner to app_owner;
revoke all on function app.mutate_owned_coach_website(integer,jsonb,text,text,boolean) from public,anon,authenticated;
grant execute on function app.mutate_owned_coach_website(integer,jsonb,text,text,boolean) to app_runtime;

create function app.public_coach_website(requested_slug text) returns table(profile_id uuid,public_slug text,revision integer,content jsonb,card_path text,hero_path text)
language sql stable security definer set search_path='' as $$
  select c.profile_id,c.public_slug,coalesce(w.revision,0),
    coalesce(w.content,'{"brandLabel":"","introduction":"","approach":"","experience":"","focusLabels":[],"faqs":[],"links":[]}'::jsonb),w.card_path,w.hero_path
  from app.coach_profiles c left join app.coach_website_content w on w.run_id=c.run_id and w.profile_id=c.profile_id
  where c.public_slug=requested_slug and app.coach_website_is_public(c.run_id,c.profile_id)
$$;
-- Dedicated read helper needs to cross existing coach RLS without mutable flags.
alter function app.public_coach_website(text) owner to postgres;
revoke all on function app.public_coach_website(text) from public,anon,authenticated;
grant execute on function app.public_coach_website(text) to app_runtime;

create function app.public_coach_website_cards(requested_profiles uuid[])
returns table(profile_id uuid,public_slug text,revision integer,content jsonb,card_path text)
language plpgsql stable security definer set search_path='' as $$
begin
  if requested_profiles is null or cardinality(requested_profiles)>100 then raise exception 'coach website card batch invalid' using errcode='22023'; end if;
  return query select c.profile_id,c.public_slug,coalesce(w.revision,0),jsonb_build_object(
    'brandLabel',coalesce(w.content->>'brandLabel',''),
    'introduction',coalesce(w.content->>'introduction',''),
    'focusLabels',coalesce(w.content->'focusLabels','[]'::jsonb)),w.card_path
    from app.coach_profiles c left join app.coach_website_content w on w.run_id=c.run_id and w.profile_id=c.profile_id
    where c.profile_id=any(requested_profiles) and app.coach_website_is_public(c.run_id,c.profile_id)
    order by c.profile_id limit 100;
end;
$$;
alter function app.public_coach_website_cards(uuid[]) owner to postgres;
revoke all on function app.public_coach_website_cards(uuid[]) from public,anon,authenticated;
grant execute on function app.public_coach_website_cards(uuid[]) to app_runtime;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('coach-banners','coach-banners',false,1048576,array['image/webp']);
create policy coach_banners_owner_insert on storage.objects for insert to authenticated with check(
  bucket_id='coach-banners' and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
  and split_part(name,'/',1)=(select app.current_storage_website_owner())::text);
create policy coach_banners_owner_select on storage.objects for select to authenticated using(
  bucket_id='coach-banners' and split_part(name,'/',1)=(select app.current_storage_website_owner())::text);
create policy coach_banners_public_current_select on storage.objects for select to anon,authenticated using(
  bucket_id='coach-banners' and app.storage_website_banner_is_current(name,true));
create policy coach_banners_owner_delete on storage.objects for delete to authenticated using(
  bucket_id='coach-banners' and split_part(name,'/',1)=(select app.current_storage_website_owner())::text
  and not app.storage_website_banner_is_current(name,false));
