-- DEV0340: reusable types. Deliberately no backfill of retained coach profiles.
create table app.coach_session_types (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  coach_profile_id uuid not null,
  format text not null check(format in ('private','group')),
  name text not null check(char_length(btrim(name)) between 1 and 80),
  description text not null default '' check(char_length(description)<=1000),
  color text not null default '#2563eb' check(color ~ '^#[0-9a-f]{6}$'),
  duration_minutes integer not null default 60 check(duration_minutes in (60,75,90)),
  default_location_id uuid,
  bookable boolean not null default true,
  archived boolean not null default false,
  revision integer not null default 0 check(revision>=0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(run_id,coach_profile_id,id),
  foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade,
  foreign key(run_id,coach_profile_id,default_location_id) references app.coach_training_locations(run_id,profile_id,id)
);
create table app.coach_session_type_commands (
  run_id uuid not null,coach_profile_id uuid not null,command_id uuid not null,
  payload jsonb not null,result jsonb not null,
  primary key(run_id,coach_profile_id,command_id),
  foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade
);
alter table app.coach_session_types owner to app_owner;
alter table app.coach_session_type_commands owner to app_owner;
alter table app.coach_session_types enable row level security;
alter table app.coach_session_types force row level security;
alter table app.coach_session_type_commands enable row level security;
alter table app.coach_session_type_commands force row level security;
revoke all on app.coach_session_types,app.coach_session_type_commands from public,anon,authenticated,app_runtime;
grant select on app.coach_session_types to app_runtime;
create policy session_types_internal on app.coach_session_types to app_owner using(true) with check(true);
create policy session_type_commands_internal on app.coach_session_type_commands to app_owner using(true) with check(true);
create policy session_types_owner on app.coach_session_types for select to app_runtime using(app.authorized_actor_context_valid(coach_profile_id,run_id,null));

create function app.new_coach_session_type_defaults() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into app.coach_session_types(run_id,coach_profile_id,format,name,color) values
    (new.run_id,new.profile_id,'private','Private session','#2563eb'),
    (new.run_id,new.profile_id,'group','Group session','#16a34a');
  return new;
end $$;
alter function app.new_coach_session_type_defaults() owner to app_owner;
revoke all on function app.new_coach_session_type_defaults() from public,anon,authenticated,app_runtime;
create trigger coach_session_type_defaults after insert on app.coach_profiles for each row execute function app.new_coach_session_type_defaults();

create function app.session_type_json(t app.coach_session_types) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('id',t.id,'format',t.format,'name',t.name,'description',t.description,
    'color',t.color,'durationMinutes',t.duration_minutes,'defaultLocationId',t.default_location_id,
    'bookable',t.bookable,'archived',t.archived,'revision',t.revision)
$$;
alter function app.session_type_json(app.coach_session_types) owner to app_owner;
revoke all on function app.session_type_json(app.coach_session_types) from public,anon,authenticated;
grant execute on function app.session_type_json(app.coach_session_types) to app_runtime;

create function app.mutate_owned_coach_session_type(command_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_run uuid;actor_profile uuid;c app.coach_profiles%rowtype;application_status text;
  prior app.coach_session_type_commands%rowtype;t app.coach_session_types%rowtype;answer jsonb;kind text;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'session type forbidden' using errcode='42501'; end if;
  actor_run:=current_setting('app.current_run_id')::uuid;actor_profile:=current_setting('app.current_profile_id')::uuid;
  if command_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'session type invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(actor_run::text,':',actor_profile::text),0));
  perform set_config('app.coach_profile_management','on',true);
  perform set_config('app.coach_application_management','on',true);
  perform set_config('app.coach_training_location_management','on',true);
  select p.* into c from app.coach_profiles p where p.run_id=actor_run and p.profile_id=actor_profile for update;
  select a.status into application_status from app.coach_applications a where a.profile_id=actor_profile for share;
  if c.profile_id is null or (not c.is_demo and coalesce(application_status,'') not in ('pending','approved','rejected')) then raise exception 'session type forbidden' using errcode='42501'; end if;
  select * into prior from app.coach_session_type_commands r where r.run_id=actor_run and r.coach_profile_id=actor_profile and r.command_id=mutate_owned_coach_session_type.command_id;
  if found then
    if prior.payload<>payload then raise exception 'session type altered retry' using errcode='P0001'; end if;
    perform set_config('app.coach_profile_management','off',true);perform set_config('app.coach_application_management','off',true);perform set_config('app.coach_training_location_management','off',true);
    return prior.result;
  end if;
  kind:=payload->>'action';
  if (kind='defaults' and payload<>'{"action":"defaults"}'::jsonb)
    or (kind in ('archive','restore') and ((payload-array['action','id','expectedRevision'])<>'{}'::jsonb or jsonb_typeof(payload->'id') is distinct from 'string' or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision')!~'^[0-9]+$'))
    or (kind='save' and ((payload-array['action','id','expectedRevision','format','name','description','color','durationMinutes','defaultLocationId','bookable'])<>'{}'::jsonb
      or jsonb_typeof(payload->'id') is distinct from 'string' or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision')!~'^(-1|[0-9]+)$'
      or jsonb_typeof(payload->'name') is distinct from 'string' or jsonb_typeof(payload->'description') is distinct from 'string' or jsonb_typeof(payload->'format') is distinct from 'string'
      or jsonb_typeof(payload->'color') is distinct from 'string' or jsonb_typeof(payload->'durationMinutes') is distinct from 'number' or (payload->>'durationMinutes')!~'^(60|75|90)$'
      or not (payload ? 'defaultLocationId') or jsonb_typeof(payload->'defaultLocationId') not in ('null','string') or jsonb_typeof(payload->'bookable') is distinct from 'boolean')) then
    raise exception 'session type invalid payload' using errcode='22023';
  end if;
  if kind='defaults' then
    if (select count(*) from app.coach_session_types s where s.run_id=actor_run and s.coach_profile_id=actor_profile)>0 then raise exception 'session type catalog is not empty' using errcode='P0001'; end if;
    insert into app.coach_session_types(run_id,coach_profile_id,format,name,color) values
      (actor_run,actor_profile,'private','Private session','#2563eb'),(actor_run,actor_profile,'group','Group session','#16a34a');
    select jsonb_agg(app.session_type_json(s) order by s.format,s.id) into answer from app.coach_session_types s where s.run_id=actor_run and s.coach_profile_id=actor_profile;
  elsif kind in ('save','archive','restore') then
    if kind='save' and (payload->>'expectedRevision')::integer=-1 then
      if (select count(*) from app.coach_session_types s where s.run_id=actor_run and s.coach_profile_id=actor_profile)>=50 then raise exception 'session type limit' using errcode='22023'; end if;
      insert into app.coach_session_types(id,run_id,coach_profile_id,format,name) values((payload->>'id')::uuid,actor_run,actor_profile,payload->>'format',payload->>'name') returning * into t;
    else
      select * into t from app.coach_session_types s where s.id=(payload->>'id')::uuid and s.run_id=actor_run and s.coach_profile_id=actor_profile for update;
      if not found then raise exception 'session type forbidden' using errcode='42501'; end if;
      if t.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'session type stale revision' using errcode='P0001'; end if;
    end if;
    if kind='save' then
      if t.format is distinct from payload->>'format' or t.archived then raise exception 'session type invalid format or archived' using errcode='22023'; end if;
      if payload->>'defaultLocationId' is not null and not exists(select 1 from app.coach_training_locations l where l.run_id=actor_run and l.profile_id=actor_profile and l.id=(payload->>'defaultLocationId')::uuid and l.status='active') then raise exception 'session type invalid venue' using errcode='22023'; end if;
      update app.coach_session_types s set name=btrim(payload->>'name'),description=payload->>'description',color=payload->>'color',duration_minutes=(payload->>'durationMinutes')::integer,
        default_location_id=(payload->>'defaultLocationId')::uuid,bookable=(payload->>'bookable')::boolean,revision=s.revision+1,updated_at=clock_timestamp() where s.id=t.id returning * into t;
    else
      update app.coach_session_types s set archived=(kind='archive'),revision=s.revision+1,updated_at=clock_timestamp() where s.id=t.id returning * into t;
    end if;
    answer:=jsonb_build_array(app.session_type_json(t));
  else raise exception 'session type invalid command' using errcode='22023'; end if;
  insert into app.coach_session_type_commands values(actor_run,actor_profile,command_id,payload,answer);
  perform set_config('app.coach_profile_management','off',true);perform set_config('app.coach_application_management','off',true);perform set_config('app.coach_training_location_management','off',true);
  return answer;
exception when others then
  perform set_config('app.coach_profile_management','off',true);perform set_config('app.coach_application_management','off',true);perform set_config('app.coach_training_location_management','off',true);
  raise;
end $$;
alter function app.mutate_owned_coach_session_type(uuid,jsonb) owner to app_owner;
revoke all on function app.mutate_owned_coach_session_type(uuid,jsonb) from public,anon,authenticated;
grant execute on function app.mutate_owned_coach_session_type(uuid,jsonb) to app_runtime;

create function app.public_coach_session_types(requested_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(app.session_type_json(t) order by t.name,t.id),'[]'::jsonb)
  from app.coach_session_types t join app.coach_profiles c on c.run_id=t.run_id and c.profile_id=t.coach_profile_id
  where c.public_slug=requested_slug and app.coach_website_is_public(c.run_id,c.profile_id)
    and not t.archived and t.bookable and (t.default_location_id is null or exists(select 1 from app.coach_training_locations l where l.run_id=t.run_id and l.profile_id=t.coach_profile_id and l.id=t.default_location_id and l.status='active'))
$$;
alter function app.public_coach_session_types(text) owner to postgres;
revoke all on function app.public_coach_session_types(text) from public,anon,authenticated;
grant execute on function app.public_coach_session_types(text) to app_runtime;
