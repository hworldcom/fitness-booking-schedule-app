-- DEV0271: owner-operated, rollback-only live SQL validation. No email is sent.
-- Requires the accepted schema/seed and an owner connection able to SET ROLE.
-- Candidate DDL and the existing pgTAP file can be injected at the marker below;
-- without injection this verifies the already installed calendar function.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
-- DEV0271_CANDIDATE_AND_PERMISSION_CHECKS

create temporary table dev0271_actors (
  label text primary key, auth_id uuid, profile_id uuid, run_id uuid, venue_id uuid
) on commit drop;
create temporary table dev0271_checks (message text) on commit drop;
grant select on dev0271_actors to app_runtime;
grant insert,select on dev0271_checks to app_runtime;
create function pg_temp.dev0271_assert(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then
    raise exception 'DEV0271 assertion failed: %',message;
  end if;
  insert into pg_temp.dev0271_checks values(message);
end $$;
create function pg_temp.dev0271_actor(requested_label text) returns void
language plpgsql as $$ declare actor record; begin
  select * into strict actor from pg_temp.dev0271_actors where label=requested_label;
  perform set_config('app.current_auth_user_id',actor.auth_id::text,true),
    set_config('app.current_profile_id',actor.profile_id::text,true),
    set_config('app.current_run_id',actor.run_id::text,true),
    set_config('app.current_run_role','member',true);
end $$;
grant execute on function pg_temp.dev0271_assert(boolean,text),pg_temp.dev0271_actor(text) to app_runtime;

-- New tagged fixtures only. Every row, approval, request and inventory write
-- below is part of this transaction and is removed by the final rollback.
do $$ declare fixture_label text; auth_id uuid; identity_row record; venue uuid;
begin
  foreach fixture_label in array array['owner','other','athlete'] loop
    auth_id:=gen_random_uuid();
    insert into auth.users(id,is_sso_user,is_anonymous) values(auth_id,false,false);
    select * into strict identity_row from app.enroll_application_identity(auth_id,'DEV0271 '||fixture_label);
    insert into pg_temp.dev0271_actors values(fixture_label,auth_id,identity_row.identity_profile_id,identity_row.identity_run_id,null);
    if fixture_label<>'athlete' then
      perform pg_temp.dev0271_actor(fixture_label);
      perform app.submit_owned_coach_application();
      perform app.upsert_owned_coach_profile('DEV0271 '||fixture_label,
        'Temporary rollback-only calendar owner used to verify SQL isolation.',array['Boxing'],
        'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null);
      perform app.review_coach_application(identity_row.identity_profile_id,'pending','approved',
        'Rollback-only migration validation.','dev0271-validation','movx-identity-application-v1');
      update app.coach_profiles set visibility='visible' where profile_id=identity_row.identity_profile_id;
      select id into strict venue from app.coach_training_locations
        where profile_id=identity_row.identity_profile_id and is_primary;
      update pg_temp.dev0271_actors set venue_id=venue where dev0271_actors.label=fixture_label;
    end if;
  end loop;
end $$;

do $$ declare actor record; hours jsonb; result jsonb; group_id uuid; starts timestamptz;
  day_offset integer; fixture_label text; slot_id uuid; request_id uuid;
begin
  perform pg_temp.dev0271_actor('owner');
  select * into strict actor from pg_temp.dev0271_actors where dev0271_actors.label='owner';
  select jsonb_agg(jsonb_build_object('isoWeekday',d,'localStartTime',h,
    'locationId',l.id,'locationUpdatedAt',to_jsonb(l.updated_at)#>>'{}')) into hours
    from app.coach_training_locations l cross join generate_series(1,7) d
    cross join unnest(array['10:00','12:00']) h where l.id=actor.venue_id;
  result:=app.save_owned_effective_coach_availability(jsonb_build_object('operationId',gen_random_uuid(),
    'expectedRevision',0,'kind','weekly','hours',hours));
  if result->>'outcome'<>'saved' then raise exception 'DEV0271 fixture hours could not be saved'; end if;

  foreach fixture_label in array array['owner','other'] loop
    perform pg_temp.dev0271_actor(fixture_label);
    select * into strict actor from pg_temp.dev0271_actors where dev0271_actors.label=fixture_label;
    foreach day_offset in array case when fixture_label='owner' then array[3,35,4] else array[3] end loop
      group_id:=gen_random_uuid();
      starts:=(((clock_timestamp() at time zone 'Europe/Berlin')::date+day_offset)+time '15:00') at time zone 'Europe/Berlin';
      result:=app.group_session_command('save-draft',jsonb_build_object('id',group_id,'expectedRevision',null,
        'title','DEV0271 calendar group','description','Rollback-only migration fixture.','discipline','Boxing',
        'intendedLevel','All levels','locationId',actor.venue_id,'startsAt',starts,'endsAt',starts+interval '1 hour',
        'decisionDeadlineAt',starts-interval '1 hour','minimumParticipants',1,'maximumParticipants',5,'priceCents',0));
      if day_offset<>4 then perform app.publish_group_session(group_id,1); end if;
    end loop;
  end loop;
  select id into strict slot_id from app.coach_availability_slots
    where profile_id=(select profile_id from pg_temp.dev0271_actors where dev0271_actors.label='owner')
      and status='open' and starts_at>clock_timestamp()+interval '1 day'
    order by starts_at limit 1;
  perform pg_temp.dev0271_actor('athlete');
  select created.request_id into request_id from app.create_coach_booking_request(slot_id) created;
  perform pg_temp.dev0271_actor('owner');
  perform app.accept_coach_booking_request(request_id);
end $$;

set local role app_runtime;
select pg_temp.dev0271_actor('owner');
do $$ declare query jsonb; first_page jsonb; second_page jsonb; filtered jsonb; item jsonb; keys text[];
  owner_venue uuid; other_venue uuid; today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;
  rejected boolean; old_flag text;
begin
  select venue_id into owner_venue from pg_temp.dev0271_actors where label='owner';
  select venue_id into other_venue from pg_temp.dev0271_actors where label='other';
  query:=jsonb_build_object('from',today,'through',today+41,'type','all','venueId',null,'history',false,'after',null);
  first_page:=app.owned_coach_calendar(query);
  perform pg_temp.dev0271_assert((first_page->>'total')::integer>50 and jsonb_array_length(first_page->'items')=50,
    'real owner period is bounded to 50 items');
  perform pg_temp.dev0271_assert(first_page->'nextCursor'<>'null'::jsonb,'crowded owner period has a real cursor');
  second_page:=app.owned_coach_calendar(query||jsonb_build_object('after',first_page->'nextCursor'));
  perform pg_temp.dev0271_assert(jsonb_array_length(second_page->'items')+50=(first_page->>'total')::integer
    and second_page->'nextCursor'='null'::jsonb,'complete second page reaches every real item');
  perform pg_temp.dev0271_assert(first_page->>'version'=second_page->>'version','unchanged paging uses one content version');
  perform pg_temp.dev0271_assert(not exists(select 1 from jsonb_array_elements(first_page->'items') a
    join jsonb_array_elements(second_page->'items') b on a->>'id'=b->>'id' and a->>'source'=b->>'source'),
    'real pages have no duplicate original identities');
  filtered:=app.owned_coach_calendar(query||jsonb_build_object('type','group'));
  perform pg_temp.dev0271_assert((filtered->>'total')::integer=2,'group filter excludes drafts and other owners');
  perform pg_temp.dev0271_assert(exists(select 1 from jsonb_array_elements(filtered->'items') i
    where (i->>'startsAt')::timestamptz>(today+29)::timestamp at time zone 'Europe/Berlin'),
    'real published group beyond private horizon remains visible');
  filtered:=app.owned_coach_calendar(query||jsonb_build_object('type','private'));
  perform pg_temp.dev0271_assert((filtered->>'total')::integer=(first_page->>'total')::integer-2,
    'private filter excludes only the real groups');
  filtered:=app.owned_coach_calendar(query||jsonb_build_object('venueId',other_venue));
  perform pg_temp.dev0271_assert((filtered->>'total')::integer=0,'another owner venue grants no calendar rows');
  filtered:=app.owned_coach_calendar(query||jsonb_build_object('venueId',owner_venue));
  perform pg_temp.dev0271_assert(filtered->>'total'=first_page->>'total','actual owner venue retains all matching rows');
  perform pg_temp.dev0271_assert(exists(select 1 from jsonb_array_elements(first_page->'items') i where i->>'source'='booking'),
    'accepted private request appears under its original booking identity');
  perform pg_temp.dev0271_assert(not exists(select 1 from jsonb_array_elements(first_page->'days') d
    where jsonb_array_length(d->'previews')>3) and exists(select 1 from jsonb_array_elements(first_page->'days') d
    where d->>'date'=(today+3)::text and (d->>'total')::integer=3 and jsonb_array_length(d->'previews')=3),
    'per-day totals and three-preview summaries include actual venues and group');
  for item in select value from jsonb_array_elements((first_page->'items')||(second_page->'items')) loop
    select array_agg(k order by k) into keys from jsonb_object_keys(item) k;
    if keys<>array['endsAt','id','locationId','pendingCount','source','startsAt','status','title','venueActive','venueLabel','venueName'] then
      raise exception 'DEV0271 calendar exposed an unexpected private field'; end if;
  end loop;
  perform pg_temp.dev0271_assert(true,'all serialized items contain only the bounded public-to-owner projection');
  rejected:=false; old_flag:=current_setting('app.effective_availability_management',true);
  begin perform app.owned_coach_calendar(query||jsonb_build_object('through',today+42));
  exception when sqlstate 'P0001' then rejected:=true; end;
  perform pg_temp.dev0271_assert(rejected,'43 local dates are rejected');
  perform pg_temp.dev0271_assert(current_setting('app.effective_availability_management',true) is not distinct from old_flag,
    'failed query restores internal management flags');
  rejected:=false;
  begin perform app.owned_coach_calendar(query||jsonb_build_object('after',jsonb_build_object(
    'at',first_page->'nextCursor'->>'at','source','availability','id',gen_random_uuid(),'queryKey','foreign')));
  exception when sqlstate 'P0001' then rejected:=true; end;
  perform pg_temp.dev0271_assert(rejected,'cursor cannot cross period or filter context');
  perform pg_temp.dev0271_actor('other');
  filtered:=app.owned_coach_calendar(query);
  perform pg_temp.dev0271_assert((filtered->>'total')::integer=1,'another valid owner sees only their own published group');
  perform pg_temp.dev0271_actor('athlete');
  rejected:=false;
  begin perform app.owned_coach_calendar(query);
  exception when sqlstate 'P0001' then rejected:=true; end;
  perform pg_temp.dev0271_assert(rejected,'unapproved athlete has no calendar owner authority');
  perform pg_temp.dev0271_actor('owner');
  perform set_config('app.current_run_id',gen_random_uuid()::text,true);
  rejected:=false;
  begin perform app.owned_coach_calendar(query);
  exception when sqlstate 'P0001' then rejected:=true; end;
  perform pg_temp.dev0271_assert(rejected,'foreign dataset context cannot read the owner calendar');
end $$;
reset role;

update app.coach_profiles set visibility='hidden'
where profile_id=(select profile_id from pg_temp.dev0271_actors where label='owner');
set local role app_runtime;
select pg_temp.dev0271_actor('owner');
do $$ declare result jsonb; today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date; begin
  result:=app.owned_coach_calendar(jsonb_build_object('from',today,'through',today+41,'type','all','venueId',null,'history',false,'after',null));
  perform pg_temp.dev0271_assert(not exists(select 1 from jsonb_array_elements(result->'items') i where i->>'source'='availability')
    and exists(select 1 from jsonb_array_elements(result->'items') i where i->>'source'='booking'),
    'hidden owner retains commitments without advertising private capacity');
end $$;
reset role;
select app.review_coach_application((select profile_id from pg_temp.dev0271_actors where label='owner'),
  'approved','suspended','Rollback-only suspension verification.','dev0271-validation','movx-identity-application-v1');
set local role app_runtime;
do $$ declare result jsonb; today date:=(clock_timestamp() at time zone 'Europe/Berlin')::date; begin
  result:=app.owned_coach_calendar(jsonb_build_object('from',today,'through',today+41,'type','all','venueId',null,'history',true,'after',null));
  perform pg_temp.dev0271_assert(not exists(select 1 from jsonb_array_elements(result->'items') i where i->>'source'='availability')
    and exists(select 1 from jsonb_array_elements(result->'items') i where i->>'source'='booking'),
    'suspended owner retains real commitment history without capacity');
end $$;
reset role;
do $$ begin
  if (select count(*) from pg_temp.dev0271_checks)<>21 then raise exception 'DEV0271 assertion count mismatch'; end if;
end $$;
rollback;
select jsonb_build_object('result','passed','positive_assertions',21,'fixtures','rolled back') as calendar_validation;
