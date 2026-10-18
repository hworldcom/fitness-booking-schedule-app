-- DEV0314: one consented review per athlete/coach pair. Independent of pricing.
create function app.valid_coach_review_text(value text, maximum integer, minimum integer default 0)
returns boolean language sql immutable set search_path='' as $$
  select value is not null and value=btrim(value) and value !~ '^[[:space:]]|[[:space:]]$' and char_length(value) between minimum and maximum
    and value !~ '[<>\u0001-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
$$;
alter function app.valid_coach_review_text(text,integer,integer) owner to app_owner;
revoke all on function app.valid_coach_review_text(text,integer,integer) from public,anon,authenticated;

create table app.coach_pair_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  coach_profile_id uuid not null,
  athlete_profile_id uuid not null,
  qualifying_booking_id uuid not null references app.coach_private_bookings(id) on delete restrict,
  rating integer not null check(rating between 1 and 5),
  comment text not null check(app.valid_coach_review_text(comment,2000)),
  attribution text not null check(app.valid_coach_review_text(attribution,80,2)),
  published boolean not null,
  moderation_hidden boolean not null default false,
  revision integer not null check(revision>0),
  last_command jsonb not null check(jsonb_typeof(last_command)='object' and octet_length(last_command::text)<=16384),
  last_actor_profile_id uuid not null,
  foreign key(run_id,last_actor_profile_id) references app.demo_run_participants(run_id,profile_id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(run_id,coach_profile_id,athlete_profile_id),
  foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id) on delete restrict,
  foreign key(run_id,athlete_profile_id) references app.demo_run_participants(run_id,profile_id) on delete restrict,
  check(coach_profile_id<>athlete_profile_id)
);
create index coach_pair_reviews_public_page on app.coach_pair_reviews(run_id,coach_profile_id,created_at desc,id desc)
  where published and not moderation_hidden;
create table app.coach_review_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references app.coach_pair_reviews(id) on delete restrict,
  run_id uuid not null,
  operator_profile_id uuid not null,
  action text not null check(action in ('hide','restore')),
  reason text not null check(app.valid_coach_review_text(reason,500,2)),
  revision integer not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(review_id,revision),
  foreign key(run_id,operator_profile_id) references app.demo_run_participants(run_id,profile_id) on delete restrict
);
alter table app.coach_pair_reviews owner to app_owner;
alter table app.coach_review_moderation_audit owner to app_owner;
alter table app.coach_pair_reviews enable row level security;
alter table app.coach_pair_reviews force row level security;
alter table app.coach_review_moderation_audit enable row level security;
alter table app.coach_review_moderation_audit force row level security;
revoke all on app.coach_pair_reviews,app.coach_review_moderation_audit from public,anon,authenticated,app_runtime;
create policy coach_pair_reviews_internal on app.coach_pair_reviews to app_owner using(true) with check(true);
create policy coach_review_audit_internal on app.coach_review_moderation_audit to app_owner using(true) with check(true);
-- Runtime cannot acquire these owner-only lookup policies by setting a flag.
create policy coach_reviews_lookup on app.coach_profiles for select to app_owner
  using(current_setting('app.pair_review_management',true)='on');
create policy coach_reviews_lookup on app.coach_private_bookings for select to app_owner
  using(current_setting('app.pair_review_management',true)='on');
create policy coach_reviews_booking_lock on app.coach_private_bookings for update to app_owner
  using(current_setting('app.pair_review_management',true)='on') with check(false);

create function app.current_coach_pair_review(requested_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; dataset uuid; coach uuid; row_value app.coach_pair_reviews%rowtype;
  eligible boolean; previous_flag text:=coalesce(current_setting('app.pair_review_management',true),''); result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) then return jsonb_build_object('status','forbidden'); end if;
  actor:=current_setting('app.current_profile_id')::uuid; dataset:=current_setting('app.current_run_id')::uuid;
  perform set_config('app.pair_review_management','on',true);
  select c.profile_id into coach from app.coach_profiles c where c.run_id=dataset and c.public_slug=requested_slug;
  if coach is null or coach=actor then
    perform set_config('app.pair_review_management',previous_flag,true);
    return jsonb_build_object('status','not-found');
  end if;
  select exists(select 1 from app.coach_private_bookings b where b.run_id=dataset and b.coach_profile_id=coach
    and b.client_profile_id=actor and b.status in ('confirmed','completed') and b.scheduled_end_at<=statement_timestamp()) into eligible;
  select r.* into row_value from app.coach_pair_reviews r where r.run_id=dataset and r.coach_profile_id=coach and r.athlete_profile_id=actor;
  if row_value.id is null and not eligible and not app.coach_website_is_public(dataset,coach) then
    perform set_config('app.pair_review_management',previous_flag,true); return jsonb_build_object('status','not-found');
  end if;
  result:=jsonb_build_object('status','ready','eligible',eligible,'review',case when row_value.id is null then null else
    jsonb_build_object('id',row_value.id,'rating',row_value.rating,'comment',row_value.comment,'attribution',row_value.attribution,
      'published',row_value.published,'moderationHidden',row_value.moderation_hidden,'revision',row_value.revision,
      'createdAt',row_value.created_at,'updatedAt',row_value.updated_at) end);
  perform set_config('app.pair_review_management',previous_flag,true); return result;
exception when others then perform set_config('app.pair_review_management',previous_flag,true); raise;
end;
$$;

create function app.mutate_coach_pair_review(requested jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; dataset uuid; coach uuid; booking uuid; target uuid; action text; expected integer;
  keys text; slug text; reason text; prior app.coach_pair_reviews%rowtype;
  score integer; body text; label text; hidden boolean; previous_flag text:=coalesce(current_setting('app.pair_review_management',true),'');
  result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) then return jsonb_build_object('status','forbidden'); end if;
  if requested is null or jsonb_typeof(requested)<>'object' or octet_length(requested::text)>16384 then return jsonb_build_object('status','invalid'); end if;
  select string_agg(key,',' order by key) into keys from jsonb_object_keys(requested) key;
  action:=requested->>'action';
  if jsonb_typeof(requested->'expectedRevision') is distinct from 'number'
    or (requested->>'expectedRevision') !~ '^(0|[1-9][0-9]{0,9})$' then return jsonb_build_object('status','invalid'); end if;
  if (requested->>'expectedRevision')::bigint>=2147483647 then return jsonb_build_object('status','invalid'); end if;
  expected:=(requested->>'expectedRevision')::integer;
  if action='publish' then
    if keys is distinct from 'action,attribution,bookingId,comment,consent,expectedRevision,rating'
      or jsonb_typeof(requested->'bookingId')<>'string' or (requested->>'bookingId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or requested->'consent' is distinct from 'true'::jsonb or jsonb_typeof(requested->'rating')<>'number'
      or (requested->>'rating') !~ '^[1-5]$' or jsonb_typeof(requested->'comment')<>'string'
      or jsonb_typeof(requested->'attribution')<>'string' then return jsonb_build_object('status','invalid'); end if;
    score:=(requested->>'rating')::integer; body:=requested->>'comment'; label:=requested->>'attribution'; booking:=(requested->>'bookingId')::uuid;
    if not app.valid_coach_review_text(body,2000) or not app.valid_coach_review_text(label,80,2)
      or label ~ '[\n\r\t]' then return jsonb_build_object('status','invalid'); end if;
  elsif action='withdraw' then
    if keys is distinct from 'action,coachSlug,expectedRevision' or jsonb_typeof(requested->'coachSlug')<>'string'
      or char_length(requested->>'coachSlug') not between 1 and 80 then return jsonb_build_object('status','invalid'); end if;
  elsif action in ('hide','restore') then
    if keys is distinct from 'action,expectedRevision,reason,reviewId' or jsonb_typeof(requested->'reviewId')<>'string'
      or (requested->>'reviewId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(requested->'reason')<>'string' or not app.valid_coach_review_text(requested->>'reason',500,2)
      then return jsonb_build_object('status','invalid'); end if;
    if not app.authorized_actor_context_valid(null,null,'operator') then return jsonb_build_object('status','forbidden'); end if;
    target:=(requested->>'reviewId')::uuid; reason:=requested->>'reason'; hidden:=action='hide';
  else return jsonb_build_object('status','invalid'); end if;
  actor:=current_setting('app.current_profile_id')::uuid; dataset:=current_setting('app.current_run_id')::uuid;
  perform set_config('app.pair_review_management','on',true);
  if action='publish' then
    select b.coach_profile_id into coach from app.coach_private_bookings b where b.id=booking and b.run_id=dataset
      and b.client_profile_id=actor and b.coach_profile_id<>actor and b.status in ('confirmed','completed')
      and b.scheduled_end_at<=statement_timestamp() for share;
    if coach is null then result:=jsonb_build_object('status','not-eligible'); end if;
  elsif action='withdraw' then
    select c.profile_id into coach from app.coach_profiles c where c.run_id=dataset and c.public_slug=requested->>'coachSlug';
    if coach is null or coach=actor then result:=jsonb_build_object('status','not-found'); end if;
  else
    select r.* into prior from app.coach_pair_reviews r where r.id=target and r.run_id=dataset for update;
    if prior.id is null then result:=jsonb_build_object('status','not-found'); end if;
  end if;
  if result is not null then perform set_config('app.pair_review_management',previous_flag,true); return result; end if;
  if action in ('publish','withdraw') then
    -- Serialize first claims against different bookings of the same pair as well as later revisions.
    perform pg_advisory_xact_lock(hashtextextended('coach-pair-review:'||dataset::text||':'||coach::text||':'||actor::text,0));
    select r.* into prior from app.coach_pair_reviews r where r.run_id=dataset and r.coach_profile_id=coach and r.athlete_profile_id=actor for update;
    if action='withdraw' and prior.id is null then result:=jsonb_build_object('status','not-found');
    elsif coalesce(prior.revision,0)<>expected then
      if prior.revision=expected+1 and prior.last_actor_profile_id=actor and prior.last_command=requested then result:=jsonb_build_object('status','saved');
      else result:=jsonb_build_object('status','conflict'); end if;
    elsif action='publish' then
      insert into app.coach_pair_reviews(run_id,coach_profile_id,athlete_profile_id,qualifying_booking_id,rating,comment,attribution,published,revision,last_command,last_actor_profile_id)
        values(dataset,coach,actor,booking,score,body,label,true,1,requested,actor)
        on conflict(run_id,coach_profile_id,athlete_profile_id) do update
        set rating=excluded.rating,comment=excluded.comment,attribution=excluded.attribution,published=true,
          revision=coach_pair_reviews.revision+1,updated_at=clock_timestamp(),last_command=requested,last_actor_profile_id=actor;
      result:=jsonb_build_object('status','saved');
    else
      update app.coach_pair_reviews set published=false,revision=revision+1,updated_at=clock_timestamp(),last_command=requested,last_actor_profile_id=actor where id=prior.id;
      result:=jsonb_build_object('status','saved');
    end if;
    if result->>'status'='saved' then
      select c.public_slug into slug from app.coach_profiles c where c.run_id=dataset and c.profile_id=coach;
      result:=(app.current_coach_pair_review(slug)-'status')||result;
    end if;
  else
    if prior.revision<>expected then
      if prior.revision=expected+1 and prior.last_actor_profile_id=actor and prior.last_command=requested then result:=jsonb_build_object('status','saved','revision',prior.revision);
      else result:=jsonb_build_object('status','conflict'); end if;
    else
      update app.coach_pair_reviews set moderation_hidden=hidden,revision=revision+1,updated_at=clock_timestamp(),last_command=requested,last_actor_profile_id=actor where id=prior.id;
      insert into app.coach_review_moderation_audit(review_id,run_id,operator_profile_id,action,reason,revision)
        values(prior.id,dataset,actor,action,reason,expected+1);
      result:=jsonb_build_object('status','saved','revision',expected+1);
    end if;
  end if;
  perform set_config('app.pair_review_management',previous_flag,true); return result;
exception when others then perform set_config('app.pair_review_management',previous_flag,true); raise;
end;
$$;

create function app.public_coach_review_summaries(requested_slugs text[])
returns table(slug text,summary jsonb) language plpgsql security definer set search_path='' as $$
declare previous_flag text:=coalesce(current_setting('app.pair_review_management',true),'');
begin
  if requested_slugs is null or cardinality(requested_slugs)>64 then raise exception 'invalid coach review query' using errcode='22023'; end if;
  perform set_config('app.pair_review_management','on',true);
  return query select c.public_slug,jsonb_build_object('count',count(r.id)::integer,
    'mean',round(avg(r.rating),1),'fictional',c.is_demo)
    from app.coach_profiles c left join app.coach_pair_reviews r on r.run_id=c.run_id and r.coach_profile_id=c.profile_id
      and r.published and not r.moderation_hidden
    where c.public_slug=any(requested_slugs) and app.coach_website_is_public(c.run_id,c.profile_id)
    group by c.public_slug,c.is_demo,c.run_id,c.profile_id;
  perform set_config('app.pair_review_management',previous_flag,true);
exception when others then perform set_config('app.pair_review_management',previous_flag,true); raise;
end;
$$;

create function app.public_coach_review_page(requested_slug text,before_created_at timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare dataset uuid; coach uuid; stats jsonb; items jsonb; next_position jsonb;
  previous_flag text:=coalesce(current_setting('app.pair_review_management',true),'');
begin
  if (before_created_at is null)<>(before_id is null) then return jsonb_build_object('status','invalid'); end if;
  perform set_config('app.pair_review_management','on',true);
  select c.run_id,c.profile_id into dataset,coach from app.coach_profiles c where c.public_slug=requested_slug
    and app.coach_website_is_public(c.run_id,c.profile_id) limit 1;
  if coach is null then perform set_config('app.pair_review_management',previous_flag,true); return jsonb_build_object('status','not-found'); end if;
  select s.summary into stats from app.public_coach_review_summaries(array[requested_slug]) s;
  with page as (select r.*,row_number() over(order by r.created_at desc,r.id desc) n from app.coach_pair_reviews r
    where r.run_id=dataset and r.coach_profile_id=coach and r.published and not r.moderation_hidden
      and (before_created_at is null or (r.created_at,r.id)<(before_created_at,before_id))
    order by r.created_at desc,r.id desc limit 21)
    select coalesce(jsonb_agg(jsonb_build_object('rating',rating,'comment',comment,'attribution',attribution,'createdAt',created_at,'updatedAt',updated_at)
      order by created_at desc,id desc) filter(where n<=20),'[]'::jsonb),
      case when max(n)>20 then (jsonb_agg(jsonb_build_object('createdAt',created_at,'id',id) order by n) filter(where n=20))->0 else null end
      into items,next_position from page;
  perform set_config('app.pair_review_management',previous_flag,true);
  return jsonb_build_object('status','ready','summary',stats,'reviews',items,'position',next_position);
exception when others then perform set_config('app.pair_review_management',previous_flag,true); raise;
end;
$$;

alter function app.current_coach_pair_review(text) owner to app_owner;
alter function app.mutate_coach_pair_review(jsonb) owner to app_owner;
alter function app.public_coach_review_summaries(text[]) owner to app_owner;
alter function app.public_coach_review_page(text,timestamptz,uuid) owner to app_owner;
revoke all on function app.current_coach_pair_review(text),app.mutate_coach_pair_review(jsonb),app.public_coach_review_summaries(text[]),app.public_coach_review_page(text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function app.current_coach_pair_review(text),app.mutate_coach_pair_review(jsonb),app.public_coach_review_summaries(text[]),app.public_coach_review_page(text,timestamptz,uuid) to app_runtime;
