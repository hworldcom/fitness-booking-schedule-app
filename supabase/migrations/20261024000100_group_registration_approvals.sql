-- MOV-77: individual registration approval, independent of event confirmation.
-- MOV-97: unregistered events retain every field. Historical registrations still
-- require a separately reviewed transition; never infer an approval decision.
-- One statement keeps the check, locks and DDL atomic in CLI fresh installs too.
do $mov97_migration$ begin
  lock table app.coach_group_sessions,app.coach_group_registrations in access exclusive mode;
  if exists(select 1 from app.coach_group_registrations) then
    raise exception 'MOV-77 requires reviewed empty registration history; preserve existing events and registrations';
  end if;

alter table app.coach_group_registrations
  alter column status set default 'pending',
  drop constraint coach_group_registrations_status_check,
  drop constraint coach_group_registrations_check,
  add column decision text,
  add column decided_at timestamptz,
  add column decided_by_profile_id uuid references app.profiles(id),
  add constraint group_registration_status check(status in ('pending','active','withdrawn','declined','approval-expired','session-cancelled','session-not-confirmed')),
  add constraint group_registration_resolution check((status in ('pending','active'))=(resolved_at is null)),
  add constraint group_registration_decision check(
    (decision is null and decided_at is null and decided_by_profile_id is null and status not in ('active','declined'))
    or (decision is not null and decision in ('approved','declined') and decided_at is not null and decided_by_profile_id is not null
      and decided_at>=created_at and (status<>'active' or decision='approved') and (status<>'declined' or decision='declined')
      and status not in ('pending','approval-expired')));
drop index app.coach_group_one_active_registration;
create unique index coach_group_one_active_registration on app.coach_group_registrations(session_id,athlete_profile_id) where status in ('pending','active');

CREATE OR REPLACE FUNCTION app.guard_group_registration() RETURNS trigger
language plpgsql set search_path='' as $$
declare activity app.coach_group_sessions; checked_at timestamptz;
begin
  if tg_op='DELETE' then
    if current_user='app_owner' then raise exception 'group registration history must be retained' using errcode='P0001'; end if;
    return old;
  end if;
  select * into activity from app.coach_group_sessions where id=new.session_id and run_id=new.run_id for update;
  checked_at:=clock_timestamp();
  if not found or new.athlete_profile_id=activity.coach_profile_id then raise exception 'group registration is unavailable' using errcode='P0001'; end if;
  if tg_op='INSERT' then
    if new.status<>'pending' or new.decision is not null then raise exception 'registration requires individual approval' using errcode='P0001'; end if;
    if activity.status not in ('open','confirmed') or activity.decision_deadline_at<=checked_at then raise exception 'group registration is closed' using errcode='P0001'; end if;
    if exists(select 1 from app.coach_group_registrations where session_id=new.session_id and athlete_profile_id=new.athlete_profile_id and decision='declined') then raise exception 'group registration was declined' using errcode='P0001'; end if;
    if (select count(*) from app.coach_group_registrations where session_id=new.session_id and status in ('pending','active'))>=activity.maximum_participants then raise exception 'group session is full or unavailable' using errcode='P0001'; end if;
    if activity.session_type_id is not null and not exists(select 1 from app.coach_session_types t where t.id=activity.session_type_id and not t.archived and t.bookable) then raise exception 'group type unavailable' using errcode='P0001'; end if;
  else
    if (new.id,new.run_id,new.session_id,new.athlete_profile_id,new.created_at) is distinct from (old.id,old.run_id,old.session_id,old.athlete_profile_id,old.created_at)
      or old.status not in ('pending','active') or new.status=old.status then raise exception 'group registration attempt is terminal' using errcode='P0001'; end if;
    if old.decision is not null and (new.decision,new.decided_at,new.decided_by_profile_id) is distinct from (old.decision,old.decided_at,old.decided_by_profile_id) then raise exception 'group approval decision is immutable' using errcode='P0001'; end if;
    if new.status in ('active','declined') then
      if old.status<>'pending' or activity.status not in ('open','confirmed') or activity.decision_deadline_at<=checked_at
        or new.decided_by_profile_id<>activity.coach_profile_id or not app.authorized_actor_context_valid(activity.coach_profile_id,activity.run_id,null)
        or not app.group_coach_enabled(activity.run_id,activity.coach_profile_id,true) then raise exception 'group approval is unavailable' using errcode='P0001'; end if;
    elsif (new.decision,new.decided_at,new.decided_by_profile_id) is distinct from (old.decision,old.decided_at,old.decided_by_profile_id) then raise exception 'group decision changed' using errcode='P0001';
    end if;
    if new.status='withdrawn' and activity.starts_at<=checked_at then raise exception 'group registration is elapsed' using errcode='P0001'; end if;
    if new.status='approval-expired' and (old.status<>'pending' or activity.status<>'confirmed' or activity.decision_deadline_at>checked_at) then raise exception 'group approval expiry conflicts' using errcode='P0001'; end if;
  end if;
  if (new.status='session-cancelled' and activity.status<>'cancelled') or (new.status='session-not-confirmed' and activity.status<>'not-confirmed') then raise exception 'group registration resolution conflicts' using errcode='P0001'; end if;
  return new;
end $$;
CREATE OR REPLACE FUNCTION app.group_reconcile_session(requested_id uuid) RETURNS app.coach_group_sessions
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare activity app.coach_group_sessions; checked_at timestamptz;
begin
  select * into activity from app.coach_group_sessions where id = requested_id for update;
  if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
  checked_at := clock_timestamp();
  if activity.status = 'open' and activity.decision_deadline_at <= checked_at then
    update app.coach_group_sessions set status = 'not-confirmed',closed_at = checked_at,updated_at = checked_at,revision = revision + 1 where id = requested_id returning * into activity;
    update app.coach_group_registrations set status = 'session-not-confirmed',resolved_at = checked_at where session_id = requested_id and status in ('pending','active');
  end if;
  if activity.status='confirmed' and activity.decision_deadline_at<=checked_at then
    update app.coach_group_registrations set status='approval-expired',resolved_at=checked_at where session_id=requested_id and status='pending';
  end if;
  return activity;
end;
$$;

CREATE OR REPLACE FUNCTION app.group_registration_projection(requested_id uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id',r.id,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at,
    'decidedAt',r.decided_at,'canWithdraw',r.status in ('pending','active') and s.starts_at > clock_timestamp())
  from app.coach_group_registrations r join app.coach_group_sessions s on s.id = r.session_id where r.id = requested_id;
$$;

CREATE OR REPLACE FUNCTION app.group_session_projection_before_types(requested_id uuid, actor uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id',s.id,'slug',s.slug,'title',s.title,'description',s.description,'discipline',s.discipline,'intendedLevel',s.intended_level,
    'venue',s.venue_snapshot,'startsAt',s.starts_at,'endsAt',s.ends_at,'decisionDeadlineAt',s.decision_deadline_at,
    'minimumParticipants',s.minimum_participants,'maximumParticipants',s.maximum_participants,'priceCents',s.price_cents,'currency',s.currency,
    'status',s.status,'displayStatus',case when s.status = 'confirmed' and s.ends_at <= clock_timestamp() then 'ended' else s.status end,
    'revision',s.revision,'createdAt',s.created_at,'updatedAt',s.updated_at,'publishedAt',s.published_at,'confirmedAt',s.confirmed_at,'closedAt',s.closed_at,
    'coach',jsonb_build_object('slug',p.public_slug,'name',p.display_name,'trustKind',app.coach_trust_kind(p.profile_id,p.is_demo)),
    'participantCount',(select count(*) from app.coach_group_registrations where session_id = s.id and status in ('pending','active')),
    'approvedParticipantCount',(select count(*) from app.coach_group_registrations where session_id=s.id and status='active'),
    'canJoin',s.status in ('open','confirmed') and s.starts_at > clock_timestamp() and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true) and (actor is null or actor <> s.coach_profile_id)
      and not exists(select 1 from app.coach_group_registrations where session_id = s.id and athlete_profile_id = actor and (status in ('pending','active') or decision='declined'))
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status in ('pending','active')) < s.maximum_participants,
    'canConfirm',coalesce(actor = s.coach_profile_id,false) and s.status = 'open' and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true)
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active') >= s.minimum_participants,
    'canCancel',coalesce(actor = s.coach_profile_id,false) and s.status in ('open','confirmed') and s.starts_at > clock_timestamp(),
    'canEdit',coalesce(actor = s.coach_profile_id,false) and s.status = 'draft' and app.group_coach_enabled(s.run_id,s.coach_profile_id,false)
  ) from app.coach_group_sessions s join app.coach_profiles p on p.run_id = s.run_id and p.profile_id = s.coach_profile_id where s.id = requested_id;
$$;

CREATE OR REPLACE FUNCTION app.group_session_command_before_types(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; registration app.coach_group_registrations;
  location app.coach_training_locations; requested_id uuid; expected_revision integer; checked_at timestamptz; entries jsonb; result jsonb;
  after_at timestamptz; after_id uuid; candidate uuid; proposed app.coach_group_sessions;
begin
  if not app.authorized_actor_context_valid(null,null,null) or jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 then
    raise exception 'group operation is unavailable' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id',true)::uuid;
  dataset := current_setting('app.current_run_id',true)::uuid;
  perform app.group_session_flags(true);
  requested_id := (args->>'id')::uuid;
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;

  if action = 'save-draft' then
    if requested_id is null then raise exception 'group draft identity is required' using errcode = 'P0001'; end if;
    perform app.group_lock_coach(dataset,actor,false);
    select * into location from app.coach_training_locations where id = (args->>'locationId')::uuid and run_id = dataset and profile_id = actor and status = 'active' for share;
    if not found then raise exception 'group location is unavailable' using errcode = 'P0001'; end if;
    if not exists(select 1 from app.coach_profile_disciplines where run_id = dataset and profile_id = actor and discipline = args->>'discipline') then raise exception 'group discipline is unavailable' using errcode = 'P0001'; end if;
    proposed.id := requested_id; proposed.run_id := dataset; proposed.coach_profile_id := actor;
    proposed.slug := 'group-' || replace(requested_id::text,'-','');
    proposed.title := btrim(args->>'title'); proposed.description := btrim(args->>'description'); proposed.discipline := args->>'discipline'; proposed.intended_level := btrim(args->>'intendedLevel');
    proposed.training_location_id := location.id;
    proposed.venue_snapshot := jsonb_build_object('id',location.id,'name',location.public_name,'label',location.public_location_label,'kind',location.location_kind,'latitude',location.latitude,'longitude',location.longitude);
    proposed.starts_at := (args->>'startsAt')::timestamptz; proposed.ends_at := (args->>'endsAt')::timestamptz; proposed.decision_deadline_at := (args->>'decisionDeadlineAt')::timestamptz;
    proposed.minimum_participants := (args->>'minimumParticipants')::smallint; proposed.maximum_participants := (args->>'maximumParticipants')::smallint; proposed.price_cents := (args->>'priceCents')::integer;
    if proposed.decision_deadline_at <= clock_timestamp() or not app.coach_local_time_is_unambiguous(proposed.starts_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.ends_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.decision_deadline_at at time zone 'Europe/Berlin','Europe/Berlin') then
      raise exception 'group time is unavailable or ambiguous' using errcode = 'P0001';
    end if;
    select * into activity from app.coach_group_sessions where id = requested_id for update;
    expected_revision := (args->>'expectedRevision')::integer;
    if found then
      if activity.run_id <> dataset or activity.coach_profile_id <> actor or activity.status <> 'draft' then raise exception 'group draft is unavailable' using errcode = 'P0001'; end if;
      if expected_revision is null and (activity.title,activity.description,activity.discipline,activity.intended_level,activity.training_location_id,activity.starts_at,activity.ends_at,activity.decision_deadline_at,activity.minimum_participants,activity.maximum_participants,activity.price_cents)
        is not distinct from (proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents) then
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      else
        if expected_revision is distinct from activity.revision then raise exception 'group draft changed' using errcode = 'P0001'; end if;
        update app.coach_group_sessions set title = proposed.title,description = proposed.description,discipline = proposed.discipline,intended_level = proposed.intended_level,
          training_location_id = proposed.training_location_id,venue_snapshot = proposed.venue_snapshot,starts_at = proposed.starts_at,ends_at = proposed.ends_at,decision_deadline_at = proposed.decision_deadline_at,
          minimum_participants = proposed.minimum_participants,maximum_participants = proposed.maximum_participants,price_cents = proposed.price_cents,revision = revision + 1,updated_at = clock_timestamp() where id = requested_id;
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      end if;
    else
      if expected_revision is not null then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents)
        values(proposed.id,proposed.run_id,proposed.coach_profile_id,proposed.slug,proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.venue_snapshot,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents);
      result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
    end if;
  elsif action in ('detail','delete-draft','join','withdraw','confirm','cancel','roster','approve-registration','decline-registration') then
    select * into activity from app.coach_group_sessions where id = requested_id and run_id = dataset;
    if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
    if (action = 'confirm' and activity.status = 'open') or (action = 'join' and not exists(
      select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor
        and (id = (args->>'registrationId')::uuid or status in ('pending','active'))
    )) then perform app.group_lock_coach(dataset,activity.coach_profile_id,true); end if;
    activity := app.group_reconcile_session(requested_id);
    checked_at := clock_timestamp();
    if action = 'detail' then
      if activity.coach_profile_id <> actor and not exists(select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor)
        and (activity.status = 'draft' or not app.group_coach_enabled(dataset,activity.coach_profile_id,true)) then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor order by created_at desc,id desc limit 1;
      result := jsonb_build_object('session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'delete-draft' then
      if activity.coach_profile_id <> actor or activity.status <> 'draft' or activity.revision is distinct from (args->>'expectedRevision')::integer then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      delete from app.coach_group_sessions where id = requested_id;
      result := jsonb_build_object('outcome','deleted');
    elsif action = 'roster' then
      if activity.coach_profile_id <> actor then raise exception 'group roster is unavailable' using errcode = 'P0001'; end if;
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('id',r.id,'name',p.display_name,'initials',p.initials,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at,'decidedAt',r.decided_at,'canDecide',r.status='pending' and activity.status in ('open','confirmed') and activity.decision_deadline_at>checked_at and app.group_coach_enabled(dataset,actor,true)),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at,r.id) into entries
        from (select * from app.coach_group_registrations where session_id = requested_id and (after_at is null or (created_at,id) > (after_at,after_id)) order by created_at,id limit 51) r join app.profiles p on p.id = r.athlete_profile_id;
      result := app.group_page(entries,50);
    elsif action in ('approve-registration','decline-registration') then
      if activity.coach_profile_id <> actor then raise exception 'group decision is unavailable' using errcode='P0001'; end if;
      select * into registration from app.coach_group_registrations where id=(args->>'registrationId')::uuid and session_id=requested_id and run_id=dataset for update;
      if not found then raise exception 'group registration is unavailable' using errcode='P0001'; end if;
      if (action='approve-registration' and registration.decision='approved') or (action='decline-registration' and registration.decision='declined') then
        result := jsonb_build_object('outcome',registration.decision,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
      elsif registration.status='pending' and activity.status in ('open','confirmed') and checked_at<activity.decision_deadline_at and app.group_coach_enabled(dataset,actor,true) then
        update app.coach_group_registrations set status=case when action='approve-registration' then 'active' else 'declined' end,
          decision=case when action='approve-registration' then 'approved' else 'declined' end,
          decided_at=checked_at,decided_by_profile_id=actor,
          resolved_at=case when action='decline-registration' then checked_at else null end
        where id=registration.id returning * into registration;
        result := jsonb_build_object('outcome',registration.decision,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
      else
        result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
      end if;
    elsif action = 'join' then
      if activity.coach_profile_id = actor then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid;
      if found then
        if registration.session_id <> requested_id or registration.athlete_profile_id <> actor or registration.run_id <> dataset then raise exception 'group registration changed' using errcode = 'P0001'; end if;
      else
        select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor and status in ('pending','active');
        if not found and not exists(select 1 from app.coach_group_registrations where session_id=requested_id and athlete_profile_id=actor and decision='declined') and activity.status in ('open','confirmed') and checked_at < activity.decision_deadline_at and checked_at < activity.starts_at then
          insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id) values((args->>'registrationId')::uuid,dataset,requested_id,actor) returning * into registration;
        end if;
      end if;
      result := jsonb_build_object('outcome',case when registration.status in ('pending','active') then 'joined' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'withdraw' then
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid and session_id = requested_id and athlete_profile_id = actor;
      if not found then raise exception 'group registration is unavailable' using errcode = 'P0001'; end if;
      if registration.status in ('pending','active') then
        if checked_at >= activity.starts_at then raise exception 'group registration is elapsed' using errcode = 'P0001'; end if;
        update app.coach_group_registrations set status = 'withdrawn',resolved_at = checked_at where id = registration.id returning * into registration;
      end if;
      result := jsonb_build_object('outcome',case when registration.status = 'withdrawn' then 'withdrawn' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    else
      if activity.coach_profile_id <> actor then raise exception 'group decision is unavailable' using errcode = 'P0001'; end if;
      if action = 'confirm' then
        if activity.status = 'confirmed' then null;
        elsif activity.status <> 'open' or checked_at >= activity.decision_deadline_at then
          result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
        else
          if (select count(*) from app.coach_group_registrations where session_id = requested_id and status = 'active') < activity.minimum_participants then raise exception 'group minimum is not met' using errcode = 'P0001'; end if;
          update app.coach_group_sessions set status = 'confirmed',confirmed_at = checked_at,confirmed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        end if;
      elsif activity.status = 'cancelled' then null;
      elsif activity.status not in ('open','confirmed') or checked_at >= activity.starts_at then
        result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
      else
        update app.coach_group_sessions set status = 'cancelled',closed_at = checked_at,closed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        update app.coach_group_registrations set status = 'session-cancelled',resolved_at = checked_at where session_id = requested_id and status in ('pending','active');
      end if;
      result := coalesce(result,jsonb_build_object('outcome',case when action = 'confirm' then 'confirmed' else 'cancelled' end,'session',app.group_session_projection(requested_id,actor)));
    end if;
  elsif action in ('owner-list','registrations') then
    -- Reconcile the bounded requested page, not an unrelated first batch of
    -- expired records. Every returned item must reflect its effective deadline.
    for candidate in select s.id from app.coach_group_sessions s where s.status in ('open','confirmed') and s.decision_deadline_at <= clock_timestamp() and (
      (action = 'owner-list' and s.id in (select id from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
      or (action = 'registrations' and s.id in (select session_id from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
    ) order by s.id loop
      perform app.group_reconcile_session(candidate);
    end loop;
    if action = 'owner-list' then
      select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,actor),'cursor',jsonb_build_object('at',s.created_at,'id',s.id)) order by s.created_at desc,s.id desc) into entries
        from (select * from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) s;
    else
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('session',app.group_session_projection(r.session_id,actor),'registration',app.group_registration_projection(r.id)),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at desc,r.id desc) into entries
        from (select * from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) r;
    end if;
    result := app.group_page(entries,20);
  else
    raise exception 'group action is unavailable' using errcode = 'P0001';
  end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;
CREATE OR REPLACE FUNCTION app.public_group_sessions(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare dataset uuid; candidate uuid; entries jsonb; result jsonb; after_at timestamptz; after_id uuid; activity app.coach_group_sessions;
begin
  if jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 or coalesce(char_length(args->>'location'),0) > 160 then raise exception 'group filters are invalid' using errcode = 'P0001'; end if;
  perform app.group_session_flags(true);
  select id into dataset from app.demo_runs where status = 'active' and catalogue_visibility = 'public';
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;
  if action = 'list' then
    -- Reconcile the returned bounded page, so earlier confirmed history cannot starve expiry.
    for candidate in select id from (select * from app.coach_group_sessions where run_id = dataset and status in ('open','confirmed') and starts_at > clock_timestamp()
        and (status = 'confirmed' or decision_deadline_at > clock_timestamp()) and app.group_coach_enabled(run_id,coach_profile_id,true)
        and (nullif(args->>'sessionTypeId','') is null or session_type_id=(args->>'sessionTypeId')::uuid)
        and (nullif(args->>'discipline','') is null or discipline = args->>'discipline')
        and strpos(lower(venue_snapshot->>'name' || ' ' || (venue_snapshot->>'label')),lower(coalesce(args->>'location',''))) > 0
        and (after_at is null or (starts_at,id) > (after_at,after_id)) order by starts_at,id limit 21) requested_page where decision_deadline_at<=clock_timestamp() order by id loop perform app.group_reconcile_session(candidate); end loop;
    select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,null),'cursor',jsonb_build_object('at',s.starts_at,'id',s.id)) order by s.starts_at,s.id) into entries
      from (select * from app.coach_group_sessions where run_id = dataset and status in ('open','confirmed') and starts_at > clock_timestamp()
        and (status = 'confirmed' or decision_deadline_at > clock_timestamp()) and app.group_coach_enabled(run_id,coach_profile_id,true)
        and (nullif(args->>'sessionTypeId','') is null or session_type_id=(args->>'sessionTypeId')::uuid)
        and (nullif(args->>'discipline','') is null or discipline = args->>'discipline')
        and strpos(lower(venue_snapshot->>'name' || ' ' || (venue_snapshot->>'label')),lower(coalesce(args->>'location',''))) > 0
        and (after_at is null or (starts_at,id) > (after_at,after_id)) order by starts_at,id limit 21) s;
    result := app.group_page(entries,20);
  elsif action = 'detail' then
    select * into activity from app.coach_group_sessions where run_id = dataset and slug = args->>'slug' and status <> 'draft';
    if found and app.group_coach_enabled(dataset,activity.coach_profile_id,true) then
      activity := app.group_reconcile_session(activity.id);
      result := jsonb_build_object('session',app.group_session_projection(activity.id,null));
    else result := jsonb_build_object('session',null); end if;
  else raise exception 'group action is unavailable' using errcode = 'P0001'; end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;
end $mov97_migration$;
