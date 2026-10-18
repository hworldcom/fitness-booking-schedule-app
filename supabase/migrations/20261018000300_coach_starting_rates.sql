-- DEV0313: optional indicative owner-chosen EUR rate; no booking-price contract.
create table app.coach_starting_rates (
  run_id uuid not null,
  profile_id uuid not null,
  amount_cents integer check(amount_cents>=0),
  show_publicly boolean not null default false,
  revision integer not null default 0 check(revision>=0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(run_id,profile_id),
  foreign key(run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade
);
alter table app.coach_starting_rates owner to app_owner;
alter table app.coach_starting_rates enable row level security;
alter table app.coach_starting_rates force row level security;
revoke all on app.coach_starting_rates from public,anon,authenticated,app_runtime;
grant select on app.coach_starting_rates to app_runtime;
create policy coach_starting_rates_internal on app.coach_starting_rates to app_owner using(true) with check(true);
create policy coach_starting_rates_owner on app.coach_starting_rates for select to app_runtime
  using(app.authorized_actor_context_valid(profile_id,run_id,null));

create function app.save_owned_coach_starting_rate(expected_revision integer,requested_amount bigint,requested_currency text,requested_public boolean)
returns table(amount_cents integer,show_publicly boolean,revision integer)
language plpgsql security definer set search_path='' as $$
declare actor_profile uuid;actor_run uuid;selected_coach app.coach_profiles%rowtype;
  current_revision integer;application_status text;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'coach starting rate forbidden' using errcode='42501'; end if;
  actor_profile:=current_setting('app.current_profile_id')::uuid;
  actor_run:=current_setting('app.current_run_id')::uuid;
  if expected_revision is null or expected_revision<0 or expected_revision>=2147483647
    or requested_currency is distinct from 'EUR' or requested_public is null
    or (requested_amount is not null and (requested_amount<0 or requested_amount>2147483647)) then
    raise exception 'coach starting rate invalid' using errcode='22023'; end if;
  perform set_config('app.coach_profile_management','on',true);
  perform set_config('app.coach_application_management','on',true);
  select c.* into selected_coach from app.coach_profiles c
    where c.run_id=actor_run and c.profile_id=actor_profile for update;
  if not found then raise exception 'coach starting rate forbidden' using errcode='42501'; end if;
  select a.status into application_status from app.coach_applications a where a.profile_id=actor_profile for share;
  if not selected_coach.is_demo and coalesce(application_status,'') not in ('pending','approved','rejected') then
    raise exception 'coach starting rate forbidden' using errcode='42501'; end if;
  insert into app.coach_starting_rates(run_id,profile_id) values(actor_run,actor_profile) on conflict do nothing;
  select r.revision into strict current_revision from app.coach_starting_rates r
    where r.run_id=actor_run and r.profile_id=actor_profile for update;
  if current_revision<>expected_revision then raise exception 'coach starting rate revision conflict' using errcode='P0001'; end if;
  return query update app.coach_starting_rates r set amount_cents=requested_amount::integer,
    show_publicly=requested_public,revision=r.revision+1,updated_at=clock_timestamp()
    where r.run_id=actor_run and r.profile_id=actor_profile returning r.amount_cents,r.show_publicly,r.revision;
  perform set_config('app.coach_profile_management','off',true);
  perform set_config('app.coach_application_management','off',true);
exception when others then
  perform set_config('app.coach_profile_management','off',true);
  perform set_config('app.coach_application_management','off',true);
  raise;
end;
$$;
alter function app.save_owned_coach_starting_rate(integer,bigint,text,boolean) owner to app_owner;
revoke all on function app.save_owned_coach_starting_rate(integer,bigint,text,boolean) from public,anon,authenticated;
grant execute on function app.save_owned_coach_starting_rate(integer,bigint,text,boolean) to app_runtime;

-- Hidden values never leave this private-table projection. Neither flag nor
-- owner revision is returned to public callers, including an authenticated owner.
create function app.public_coach_starting_rate_projection(requested_run uuid,requested_profile uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('schemaVersion',1,'amountCents',r.amount_cents,'currency','EUR','context','private-session')
  from app.coach_starting_rates r where r.run_id=requested_run and r.profile_id=requested_profile
    and r.show_publicly and r.amount_cents is not null and app.coach_website_is_public(r.run_id,r.profile_id)
$$;
alter function app.public_coach_starting_rate_projection(uuid,uuid) owner to postgres;
revoke all on function app.public_coach_starting_rate_projection(uuid,uuid) from public,anon,authenticated,app_runtime;

create function app.public_coach_starting_rate(requested_slug text) returns table(starting_rate jsonb)
language sql stable security definer set search_path='' as $$
  select app.public_coach_starting_rate_projection(c.run_id,c.profile_id) from app.coach_profiles c
    where c.public_slug=requested_slug and app.coach_website_is_public(c.run_id,c.profile_id)
$$;
alter function app.public_coach_starting_rate(text) owner to postgres;
revoke all on function app.public_coach_starting_rate(text) from public,anon,authenticated;
grant execute on function app.public_coach_starting_rate(text) to app_runtime;

-- New wrappers retain the original website functions/signatures for older app
-- versions. Public row shapes append only disclosed numeric data, never raw rates.
create function app.public_coach_website_pricing(requested_slug text)
returns table(profile_id uuid,public_slug text,revision integer,content jsonb,card_path text,hero_path text,starting_rate jsonb)
language sql stable security definer set search_path='' as $$
  select w.*,app.public_coach_starting_rate_projection(c.run_id,c.profile_id)
    from app.public_coach_website(requested_slug) w join app.coach_profiles c
      on c.profile_id=w.profile_id and c.public_slug=w.public_slug
$$;
alter function app.public_coach_website_pricing(text) owner to postgres;
revoke all on function app.public_coach_website_pricing(text) from public,anon,authenticated;
grant execute on function app.public_coach_website_pricing(text) to app_runtime;

create function app.public_coach_website_cards_pricing(requested_profiles uuid[])
returns table(profile_id uuid,public_slug text,revision integer,content jsonb,card_path text,starting_rate jsonb)
language sql stable security definer set search_path='' as $$
  select w.*,app.public_coach_starting_rate_projection(c.run_id,c.profile_id)
    from app.public_coach_website_cards(requested_profiles) w join app.coach_profiles c
      on c.profile_id=w.profile_id and c.public_slug=w.public_slug
$$;
alter function app.public_coach_website_cards_pricing(uuid[]) owner to postgres;
revoke all on function app.public_coach_website_cards_pricing(uuid[]) from public,anon,authenticated;
grant execute on function app.public_coach_website_cards_pricing(uuid[]) to app_runtime;
