-- DEV0331: opt-in publication only. No existing private username is backfilled.
create table app.coach_public_handles (
  username text primary key check(username ~ '^[a-z][a-z0-9_]{2,29}$'),
  profile_id uuid references app.profiles(id) on delete set null,
  confirmed_at timestamptz not null default clock_timestamp()
);
create index coach_public_handles_owner on app.coach_public_handles(profile_id);
alter table app.coach_public_handles owner to app_owner;
alter table app.coach_public_handles enable row level security;
alter table app.coach_public_handles force row level security;
revoke all on app.coach_public_handles from public,anon,authenticated,app_runtime;
create policy coach_public_handles_internal on app.coach_public_handles to app_owner using(true) with check(true);

-- One short lock serializes reservations with every canonical claim, including
-- enrollment and ordinary Account updates. The original unique constraint still
-- owns current private claims. Trigger errors use its existing public-safe code.
create function app.guard_published_coach_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(3381,1);
  if new.username is null then
    if exists(select 1 from app.coach_public_handles where profile_id=new.profile_id) then
      raise exception 'Replace your published username rather than clearing it.'
        using errcode='23514',constraint='published_coach_username_required';
    end if;
    return new;
  end if;
  if exists(select 1 from app.coach_public_handles h where h.username=new.username
    and h.profile_id is distinct from new.profile_id) then
    raise exception 'Username unavailable.' using errcode='23505',constraint='account_username_unique';
  end if;
  if exists(select 1 from app.coach_public_handles where profile_id=new.profile_id) then
    insert into app.coach_public_handles(username,profile_id) values(new.username,new.profile_id)
      on conflict(username) do nothing;
  end if;
  return new;
end $$;
alter function app.guard_published_coach_username() owner to postgres;
revoke all on function app.guard_published_coach_username() from public,anon,authenticated,app_runtime;
create trigger account_published_username_guard before insert or update of username on app.account_personal_details
  for each row execute function app.guard_published_coach_username();

-- Translate the clear guard inside a SQL exception boundary, after its failed
-- write has rolled back. Catching an aborted transaction in JavaScript is unsafe.
alter function app.update_current_account_settings(text,jsonb,integer) rename to update_account_settings_before_public_handles;
revoke all on function app.update_account_settings_before_public_handles(text,jsonb,integer) from app_runtime;
create function app.update_current_account_settings(requested_section text,requested_values jsonb,expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare violated_constraint text;
begin
  return app.update_account_settings_before_public_handles(requested_section,requested_values,expected_revision);
exception when check_violation then
  get stacked diagnostics violated_constraint=constraint_name;
  if violated_constraint='published_coach_username_required' then
    return jsonb_build_object('status','username-required');
  end if;
  raise;
end $$;
alter function app.update_current_account_settings(text,jsonb,integer) owner to app_owner;
revoke all on function app.update_current_account_settings(text,jsonb,integer) from public,anon,authenticated;
grant execute on function app.update_current_account_settings(text,jsonb,integer) to app_runtime;

create function app.owned_coach_public_handle() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'Coach URL actor unavailable.' using errcode='42501';
  end if;
  actor:=current_setting('app.current_profile_id',true)::uuid;
  if not exists(select 1 from app.coach_profiles c where c.profile_id=actor
    and c.run_id::text=current_setting('app.current_run_id',true)
    and app.coach_trust_kind(c.profile_id,c.is_demo) is not null) then
    return jsonb_build_object('status','forbidden');
  end if;
  select jsonb_build_object('status','ready','schemaVersion',1,'username',d.username,
    'revision',coalesce(d.revision,0),'confirmed',exists(
      select 1 from app.coach_public_handles h where h.profile_id=actor and h.username=d.username))
    into result from app.profiles p left join app.account_personal_details d on d.profile_id=p.id where p.id=actor;
  return result;
end $$;
alter function app.owned_coach_public_handle() owner to postgres;
revoke all on function app.owned_coach_public_handle() from public,anon,authenticated;
grant execute on function app.owned_coach_public_handle() to app_runtime;

create function app.confirm_owned_coach_public_handle(expected_username text,expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; details jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'Coach URL actor unavailable.' using errcode='42501';
  end if;
  actor:=current_setting('app.current_profile_id',true)::uuid;
  -- Same profile-row -> reservation-lock order as Account writes.
  perform 1 from app.profiles where id=actor for update;
  perform pg_catalog.pg_advisory_xact_lock(3381,1);
  details:=app.owned_coach_public_handle();
  if details->>'status'<>'ready' then return details; end if;
  if expected_username is null or expected_username !~ '^[a-z][a-z0-9_]{2,29}$'
    or expected_revision is null or expected_revision<0 then
    return jsonb_build_object('status','invalid');
  end if;
  if details->>'username' is distinct from expected_username
    or (details->>'revision')::integer<>expected_revision then
    return jsonb_build_object('status','conflict');
  end if;
  insert into app.coach_public_handles(username,profile_id) values(expected_username,actor)
    on conflict(username) do nothing;
  if not exists(select 1 from app.coach_public_handles where username=expected_username and profile_id=actor) then
    return jsonb_build_object('status','conflict');
  end if;
  return app.owned_coach_public_handle();
end $$;
alter function app.confirm_owned_coach_public_handle(text,integer) owner to postgres;
revoke all on function app.confirm_owned_coach_public_handle(text,integer) from public,anon,authenticated;
grant execute on function app.confirm_owned_coach_public_handle(text,integer) to app_runtime;

-- Bounded public lookup, never a public Account query. Every alias rechecks live
-- catalogue, approval, visibility and publishable-location authority.
create function app.public_coach_handle(requested_value text,by_slug boolean default false)
returns table(public_slug text,username text)
language sql stable security definer set search_path='' as $$
  select c.public_slug,d.username from app.coach_profiles c
    join app.account_personal_details d on d.profile_id=c.profile_id
    join app.coach_public_handles current_handle on current_handle.username=d.username and current_handle.profile_id=c.profile_id
    where app.coach_website_is_public(c.run_id,c.profile_id)
      and case when by_slug then c.public_slug=requested_value else exists(
        select 1 from app.coach_public_handles alias where alias.username=requested_value and alias.profile_id=c.profile_id) end
$$;
alter function app.public_coach_handle(text,boolean) owner to postgres;
revoke all on function app.public_coach_handle(text,boolean) from public,anon,authenticated;
grant execute on function app.public_coach_handle(text,boolean) to app_runtime;
