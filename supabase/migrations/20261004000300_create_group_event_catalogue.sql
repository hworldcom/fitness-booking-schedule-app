-- Persist application-owned group-event metadata while keeping finalized
-- Solana EventPool and Contribution projections authoritative for funding.

create table app.group_events (
  id uuid primary key,
  run_id uuid not null,
  coach_profile_id uuid not null,
  public_slug text not null,
  title text not null,
  discipline text not null,
  description text not null,
  coach_slug_snapshot text not null,
  coach_display_name_snapshot text not null,
  location_kind_snapshot text not null,
  location_label_snapshot text not null,
  location_timezone_snapshot text not null,
  latitude_snapshot numeric(9, 6) not null,
  longitude_snapshot numeric(9, 6) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  media_url text null,
  source_proposal_id uuid null,
  publication_status text not null default 'draft',
  published_at timestamptz null,
  withdrawn_at timestamptz null,
  program_address text null,
  event_pool_address text null,
  coach_wallet_address_snapshot text null,
  projection_availability text not null default 'unbound',
  projection_status_updated_at timestamptz null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_events_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint group_events_run_id_id_key unique (run_id, id),
  constraint group_events_run_slug_key unique (run_id, public_slug),
  constraint group_events_pool_key unique (program_address, event_pool_address),
  constraint group_events_slug_check
    check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint group_events_title_check
    check (char_length(title) between 3 and 120 and title !~ '[[:cntrl:]]'),
  constraint group_events_discipline_check check (
    discipline in (
      'Boxing',
      'Muay Thai',
      'Kickboxing',
      'Brazilian Jiu-Jitsu',
      'MMA',
      'Wrestling'
    )
  ),
  constraint group_events_description_check check (
    char_length(description) between 20 and 2000
    and description !~ '[[:cntrl:]]'
  ),
  constraint group_events_coach_snapshot_check check (
    coach_slug_snapshot ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(coach_display_name_snapshot) between 2 and 80
  ),
  constraint group_events_location_kind_check
    check (location_kind_snapshot in ('gym', 'independent')),
  constraint group_events_location_label_check
    check (char_length(location_label_snapshot) between 2 and 240),
  constraint group_events_location_timezone_check check (
    location_timezone_snapshot = 'UTC'
    or location_timezone_snapshot ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
  ),
  constraint group_events_latitude_check
    check (latitude_snapshot between -90 and 90),
  constraint group_events_longitude_check
    check (longitude_snapshot between -180 and 180),
  constraint group_events_time_check check (
    ends_at - starts_at between interval '30 minutes' and interval '12 hours'
  ),
  constraint group_events_media_url_check check (
    media_url is null
    or (
      char_length(media_url) between 1 and 1024
      and media_url !~ '[[:space:]]'
      and (media_url ~ '^https://' or media_url ~ '^/')
    )
  ),
  constraint group_events_publication_status_check
    check (publication_status in ('draft', 'published', 'withdrawn')),
  constraint group_events_publication_state_check check (
    (publication_status = 'draft' and published_at is null and withdrawn_at is null)
    or (publication_status = 'published' and published_at is not null and withdrawn_at is null)
    or (publication_status = 'withdrawn' and published_at is null and withdrawn_at is not null)
  ),
  constraint group_events_binding_address_check check (
    (
      program_address is null
      and event_pool_address is null
      and coach_wallet_address_snapshot is null
    )
    or (
      program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
      and event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
      and coach_wallet_address_snapshot ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    )
  ),
  constraint group_events_projection_availability_check
    check (projection_availability in ('unbound', 'pending', 'current', 'unavailable')),
  constraint group_events_projection_binding_check check (
    (
      projection_availability = 'unbound'
      and program_address is null
      and event_pool_address is null
      and coach_wallet_address_snapshot is null
      and projection_status_updated_at is null
    )
    or (
      projection_availability <> 'unbound'
      and program_address is not null
      and event_pool_address is not null
      and coach_wallet_address_snapshot is not null
      and projection_status_updated_at is not null
    )
  ),
  constraint group_events_published_binding_check check (
    publication_status <> 'published'
    or (
      program_address is not null
      and event_pool_address is not null
      and projection_availability <> 'unbound'
    )
  ),
  constraint group_events_record_source_check
    check (record_source in ('fixture', 'user'))
);

create table app.group_event_pool_projections (
  event_id uuid primary key,
  run_id uuid not null,
  program_address text not null,
  event_pool_address text not null,
  vault_address text not null,
  coach_authority_address text not null,
  payout_recipient_address text not null,
  mint_address text not null,
  token_program_address text not null,
  seat_price_base_units bigint not null,
  minimum_participants smallint not null,
  maximum_participants smallint not null,
  participant_count smallint not null,
  funding_deadline timestamptz not null,
  event_starts_at timestamptz not null,
  event_ends_at timestamptz not null,
  lifecycle_status text not null,
  transaction_signature text not null,
  observed_slot bigint not null,
  finalized_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_event_pool_projections_event_fkey
    foreign key (run_id, event_id)
    references app.group_events (run_id, id)
    on delete restrict,
  constraint group_event_pool_projections_pool_key
    unique (program_address, event_pool_address),
  constraint group_event_pool_projections_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and vault_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and payout_recipient_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and mint_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and token_program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and mint_address = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
    and token_program_address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  ),
  constraint group_event_pool_projections_price_check
    check (seat_price_base_units between 1 and 9000000000000000),
  constraint group_event_pool_projections_capacity_check check (
    minimum_participants between 2 and 50
    and maximum_participants between minimum_participants and 50
    and participant_count between 0 and maximum_participants
  ),
  constraint group_event_pool_projections_time_check check (
    funding_deadline < event_starts_at
    and event_ends_at - event_starts_at
      between interval '30 minutes' and interval '12 hours'
  ),
  constraint group_event_pool_projections_lifecycle_check
    check (lifecycle_status in ('funding', 'succeeded', 'paid', 'failed')),
  constraint group_event_pool_projections_lifecycle_count_check check (
    lifecycle_status = 'funding'
    or (lifecycle_status in ('succeeded', 'paid') and participant_count >= minimum_participants)
    or (lifecycle_status = 'failed' and participant_count < minimum_participants)
  ),
  constraint group_event_pool_projections_signature_check
    check (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'),
  constraint group_event_pool_projections_slot_check check (observed_slot >= 0)
);

create table app.group_event_contribution_projections (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  event_id uuid not null,
  participant_profile_id uuid not null,
  program_address text not null,
  event_pool_address text not null,
  contribution_address text not null,
  participant_wallet_address text not null,
  amount_base_units bigint not null,
  lifecycle_status text not null,
  transaction_signature text not null,
  observed_slot bigint not null,
  finalized_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_event_contribution_projections_event_fkey
    foreign key (run_id, event_id)
    references app.group_events (run_id, id)
    on delete restrict,
  constraint group_event_contribution_projections_participant_fkey
    foreign key (run_id, participant_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint group_event_contribution_projections_event_wallet_key
    unique (event_id, participant_wallet_address),
  constraint group_event_contribution_projections_address_key
    unique (program_address, contribution_address),
  constraint group_event_contribution_projections_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and contribution_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and participant_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint group_event_contribution_projections_amount_check
    check (amount_base_units between 1 and 9000000000000000),
  constraint group_event_contribution_projections_lifecycle_check
    check (lifecycle_status in ('funded', 'refundable', 'refunded', 'successful')),
  constraint group_event_contribution_projections_signature_check
    check (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'),
  constraint group_event_contribution_projections_slot_check
    check (observed_slot >= 0)
);

create index group_events_public_catalogue_idx
  on app.group_events (publication_status, starts_at, id);
create index group_events_owner_idx
  on app.group_events (run_id, coach_profile_id, created_at desc, id);
create index group_events_pool_availability_idx
  on app.group_events (projection_availability, projection_status_updated_at, id)
  where event_pool_address is not null;
create index group_event_pool_projections_lifecycle_idx
  on app.group_event_pool_projections (lifecycle_status, funding_deadline, event_id);
create index group_event_contribution_projections_participant_idx
  on app.group_event_contribution_projections (
    run_id,
    participant_profile_id,
    finalized_at desc,
    id
  );

create trigger group_events_set_updated_at
before update on app.group_events
for each row execute function app.set_updated_at();
create trigger group_event_pool_projections_set_updated_at
before update on app.group_event_pool_projections
for each row execute function app.set_updated_at();
create trigger group_event_contribution_projections_set_updated_at
before update on app.group_event_contribution_projections
for each row execute function app.set_updated_at();

alter table app.group_events enable row level security;
alter table app.group_events force row level security;
alter table app.group_event_pool_projections enable row level security;
alter table app.group_event_pool_projections force row level security;
alter table app.group_event_contribution_projections enable row level security;
alter table app.group_event_contribution_projections force row level security;

alter table app.group_events owner to app_owner;
alter table app.group_event_pool_projections owner to app_owner;
alter table app.group_event_contribution_projections owner to app_owner;

revoke all on app.group_events,
  app.group_event_pool_projections,
  app.group_event_contribution_projections
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.group_events,
  app.group_event_pool_projections,
  app.group_event_contribution_projections
  from app_runtime;
grant select on app.group_events,
  app.group_event_pool_projections,
  app.group_event_contribution_projections
  to app_runtime;

create policy group_events_management_all
  on app.group_events
  for all
  to app_owner
  using (current_setting('app.group_event_management', true) = 'on')
  with check (current_setting('app.group_event_management', true) = 'on');
create policy group_event_pool_projections_management_all
  on app.group_event_pool_projections
  for all
  to app_owner
  using (current_setting('app.group_event_management', true) = 'on')
  with check (current_setting('app.group_event_management', true) = 'on');
create policy group_event_contribution_projections_management_all
  on app.group_event_contribution_projections
  for all
  to app_owner
  using (current_setting('app.group_event_management', true) = 'on')
  with check (current_setting('app.group_event_management', true) = 'on');

create policy group_events_owner_select
  on app.group_events
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(coach_profile_id, run_id, null));
create policy group_events_public_select
  on app.group_events
  for select
  to app_runtime
  using (
    publication_status = 'published'
    and exists (
      select 1
      from app.demo_runs as run
      where run.id = group_events.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
  );
create policy group_event_pool_projections_owner_select
  on app.group_event_pool_projections
  for select
  to app_runtime
  using (
    exists (
      select 1
      from app.group_events as event
      where event.id = group_event_pool_projections.event_id
        and event.run_id = group_event_pool_projections.run_id
        and app.authorized_actor_context_valid(
          event.coach_profile_id,
          event.run_id,
          null
        )
    )
  );
create policy group_event_pool_projections_public_select
  on app.group_event_pool_projections
  for select
  to app_runtime
  using (
    exists (
      select 1
      from app.group_events as event
      where event.id = group_event_pool_projections.event_id
        and event.run_id = group_event_pool_projections.run_id
        and event.publication_status = 'published'
    )
  );
create policy group_event_contribution_projections_actor_select
  on app.group_event_contribution_projections
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(
      participant_profile_id,
      run_id,
      null
    )
    or exists (
      select 1
      from app.group_events as event
      where event.id = group_event_contribution_projections.event_id
        and event.run_id = group_event_contribution_projections.run_id
        and app.authorized_actor_context_valid(
          event.coach_profile_id,
          event.run_id,
          null
        )
    )
  );

create function app.create_owned_group_event_draft(
  requested_event_id uuid,
  requested_title text,
  requested_discipline text,
  requested_description text,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_media_url text,
  requested_source_proposal_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  normalized_title text;
  normalized_description text;
  selected_coach record;
  slug_prefix text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;

  normalized_title := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_title, '[[:space:]]+', ' ', 'g')
  );
  normalized_description := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_description, '[[:space:]]+', ' ', 'g')
  );
  if requested_event_id is null
    or normalized_title is null
    or pg_catalog.char_length(normalized_title) not between 3 and 120
    or normalized_title ~ '[[:cntrl:]]'
    or normalized_description is null
    or pg_catalog.char_length(normalized_description) not between 20 and 2000
    or normalized_description ~ '[[:cntrl:]]'
    or requested_discipline not in (
      'Boxing', 'Muay Thai', 'Kickboxing',
      'Brazilian Jiu-Jitsu', 'MMA', 'Wrestling'
    )
    or requested_starts_at <= pg_catalog.statement_timestamp()
    or requested_ends_at - requested_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or (
      requested_media_url is not null
      and (
        pg_catalog.char_length(requested_media_url) not between 1 and 1024
        or requested_media_url ~ '[[:space:]]'
        or not (requested_media_url ~ '^https://' or requested_media_url ~ '^/')
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'group event draft details are invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);

  select
    coach.public_slug,
    coach.display_name,
    coach.location_kind,
    coach.public_location_label,
    coach.timezone,
    coach.latitude,
    coach.longitude
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid;
  if not found then
    raise exception using errcode = 'P0001', message = 'group event coach is unavailable';
  end if;

  slug_prefix := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(normalized_title),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '-'
  );
  if slug_prefix = '' then slug_prefix := 'group-event'; end if;

  insert into app.group_events (
    id,
    run_id,
    coach_profile_id,
    public_slug,
    title,
    discipline,
    description,
    coach_slug_snapshot,
    coach_display_name_snapshot,
    location_kind_snapshot,
    location_label_snapshot,
    location_timezone_snapshot,
    latitude_snapshot,
    longitude_snapshot,
    starts_at,
    ends_at,
    media_url,
    source_proposal_id,
    record_source
  ) values (
    requested_event_id,
    run_id_text::uuid,
    profile_id_text::uuid,
    pg_catalog.concat(
      pg_catalog.left(slug_prefix, 90),
      '-',
      pg_catalog.left(
        pg_catalog.replace(requested_event_id::text, '-', ''),
        12
      )
    ),
    normalized_title,
    requested_discipline,
    normalized_description,
    selected_coach.public_slug,
    selected_coach.display_name,
    selected_coach.location_kind,
    selected_coach.public_location_label,
    selected_coach.timezone,
    selected_coach.latitude,
    selected_coach.longitude,
    requested_starts_at,
    requested_ends_at,
    requested_media_url,
    requested_source_proposal_id,
    'user'
  );

  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.update_owned_group_event_draft(
  requested_event_id uuid,
  requested_title text,
  requested_discipline text,
  requested_description text,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_media_url text,
  requested_source_proposal_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  normalized_title text;
  normalized_description text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  normalized_title := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_title, '[[:space:]]+', ' ', 'g')
  );
  normalized_description := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_description, '[[:space:]]+', ' ', 'g')
  );
  if normalized_title is null
    or pg_catalog.char_length(normalized_title) not between 3 and 120
    or normalized_title ~ '[[:cntrl:]]'
    or normalized_description is null
    or pg_catalog.char_length(normalized_description) not between 20 and 2000
    or normalized_description ~ '[[:cntrl:]]'
    or requested_discipline not in (
      'Boxing', 'Muay Thai', 'Kickboxing',
      'Brazilian Jiu-Jitsu', 'MMA', 'Wrestling'
    )
    or requested_starts_at <= pg_catalog.statement_timestamp()
    or requested_ends_at - requested_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or (
      requested_media_url is not null
      and (
        pg_catalog.char_length(requested_media_url) not between 1 and 1024
        or requested_media_url ~ '[[:space:]]'
        or not (requested_media_url ~ '^https://' or requested_media_url ~ '^/')
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'group event draft details are invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set
    title = normalized_title,
    discipline = requested_discipline,
    description = normalized_description,
    starts_at = requested_starts_at,
    ends_at = requested_ends_at,
    media_url = requested_media_url,
    source_proposal_id = requested_source_proposal_id
  where id = requested_event_id
    and run_id = run_id_text::uuid
    and coach_profile_id = profile_id_text::uuid
    and publication_status = 'draft'
    and projection_availability = 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event draft cannot be updated';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.bind_owned_group_event_pool(
  requested_event_id uuid,
  requested_program_address text,
  requested_event_pool_address text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_event record;
  selected_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  then
    raise exception using errcode = 'P0001', message = 'group event pool binding is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
    and event.coach_profile_id = profile_id_text::uuid
  for update;
  if not found
    or selected_event.publication_status <> 'draft'
    or selected_event.starts_at <= pg_catalog.statement_timestamp()
  then
    raise exception using errcode = 'P0001', message = 'group event pool binding is unavailable';
  end if;

  select binding.wallet_address into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';
  if selected_wallet_address is null then
    raise exception using errcode = 'P0001', message = 'group event coach wallet is unavailable';
  end if;

  if selected_event.projection_availability <> 'unbound' then
    if selected_event.program_address = requested_program_address
      and selected_event.event_pool_address = requested_event_pool_address
      and selected_event.coach_wallet_address_snapshot = selected_wallet_address
    then
      perform pg_catalog.set_config('app.wallet_management', 'off', true);
      perform pg_catalog.set_config('app.group_event_management', 'off', true);
      return requested_event_id;
    end if;
    raise exception using errcode = 'P0001', message = 'group event already has a different pool binding';
  end if;

  update app.group_events
  set
    program_address = requested_program_address,
    event_pool_address = requested_event_pool_address,
    coach_wallet_address_snapshot = selected_wallet_address,
    projection_availability = 'pending',
    projection_status_updated_at = pg_catalog.statement_timestamp()
  where id = requested_event_id;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.record_verified_group_event_pool_projection(
  requested_event_id uuid,
  verified_program_address text,
  verified_event_pool_address text,
  verified_vault_address text,
  verified_coach_authority_address text,
  verified_payout_recipient_address text,
  verified_mint_address text,
  verified_token_program_address text,
  verified_seat_price_base_units bigint,
  verified_minimum_participants smallint,
  verified_maximum_participants smallint,
  verified_participant_count smallint,
  verified_funding_deadline timestamptz,
  verified_event_starts_at timestamptz,
  verified_event_ends_at timestamptz,
  verified_lifecycle_status text,
  verified_transaction_signature text,
  verified_observed_slot bigint,
  verified_finalized_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event record;
  existing_projection record;
begin
  if verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_vault_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_payout_recipient_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_token_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address <> '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
    or verified_token_program_address <> 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_seat_price_base_units not between 1 and 9000000000000000
    or verified_minimum_participants not between 2 and 50
    or verified_maximum_participants not between verified_minimum_participants and 50
    or verified_participant_count not between 0 and verified_maximum_participants
    or verified_funding_deadline >= verified_event_starts_at
    or verified_event_ends_at - verified_event_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or verified_lifecycle_status not in ('funding', 'succeeded', 'paid', 'failed')
    or (
      verified_lifecycle_status in ('succeeded', 'paid')
      and verified_participant_count < verified_minimum_participants
    )
    or (
      verified_lifecycle_status = 'failed'
      and verified_participant_count >= verified_minimum_participants
    )
    or verified_observed_slot < 0
    or verified_finalized_at is null
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence is invalid';
  end if;

  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id
  for update;
  if not found
    or selected_event.program_address <> verified_program_address
    or selected_event.event_pool_address <> verified_event_pool_address
    or selected_event.coach_wallet_address_snapshot <> verified_coach_authority_address
    or selected_event.starts_at <> verified_event_starts_at
    or selected_event.ends_at <> verified_event_ends_at
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence does not match metadata';
  end if;

  select * into existing_projection
  from app.group_event_pool_projections as projection
  where projection.event_id = requested_event_id
  for update;

  if found then
    if verified_observed_slot < existing_projection.observed_slot
      or existing_projection.program_address <> verified_program_address
      or existing_projection.event_pool_address <> verified_event_pool_address
      or existing_projection.vault_address <> verified_vault_address
      or existing_projection.coach_authority_address <> verified_coach_authority_address
      or existing_projection.payout_recipient_address <> verified_payout_recipient_address
      or existing_projection.mint_address <> verified_mint_address
      or existing_projection.token_program_address <> verified_token_program_address
      or existing_projection.seat_price_base_units <> verified_seat_price_base_units
      or existing_projection.minimum_participants <> verified_minimum_participants
      or existing_projection.maximum_participants <> verified_maximum_participants
      or existing_projection.funding_deadline <> verified_funding_deadline
      or existing_projection.event_starts_at <> verified_event_starts_at
      or existing_projection.event_ends_at <> verified_event_ends_at
      or verified_participant_count < existing_projection.participant_count
      or not (
        (existing_projection.lifecycle_status = 'funding' and verified_lifecycle_status in ('funding', 'succeeded', 'failed'))
        or (existing_projection.lifecycle_status = 'succeeded' and verified_lifecycle_status in ('succeeded', 'paid'))
        or (existing_projection.lifecycle_status = 'paid' and verified_lifecycle_status = 'paid')
        or (existing_projection.lifecycle_status = 'failed' and verified_lifecycle_status = 'failed')
      )
    then
      raise exception using errcode = 'P0001', message = 'group event pool evidence is stale or conflicting';
    end if;

    if verified_observed_slot = existing_projection.observed_slot then
      if existing_projection.participant_count <> verified_participant_count
        or existing_projection.lifecycle_status <> verified_lifecycle_status
        or existing_projection.transaction_signature <> verified_transaction_signature
        or existing_projection.finalized_at <> verified_finalized_at
      then
        raise exception using errcode = 'P0001', message = 'group event pool evidence conflicts at the same slot';
      end if;
    else
      update app.group_event_pool_projections
      set
        participant_count = verified_participant_count,
        lifecycle_status = verified_lifecycle_status,
        transaction_signature = verified_transaction_signature,
        observed_slot = verified_observed_slot,
        finalized_at = verified_finalized_at
      where event_id = requested_event_id;
    end if;
  else
    insert into app.group_event_pool_projections (
      event_id,
      run_id,
      program_address,
      event_pool_address,
      vault_address,
      coach_authority_address,
      payout_recipient_address,
      mint_address,
      token_program_address,
      seat_price_base_units,
      minimum_participants,
      maximum_participants,
      participant_count,
      funding_deadline,
      event_starts_at,
      event_ends_at,
      lifecycle_status,
      transaction_signature,
      observed_slot,
      finalized_at
    ) values (
      requested_event_id,
      selected_event.run_id,
      verified_program_address,
      verified_event_pool_address,
      verified_vault_address,
      verified_coach_authority_address,
      verified_payout_recipient_address,
      verified_mint_address,
      verified_token_program_address,
      verified_seat_price_base_units,
      verified_minimum_participants,
      verified_maximum_participants,
      verified_participant_count,
      verified_funding_deadline,
      verified_event_starts_at,
      verified_event_ends_at,
      verified_lifecycle_status,
      verified_transaction_signature,
      verified_observed_slot,
      verified_finalized_at
    );
  end if;

  update app.group_events
  set
    projection_availability = 'current',
    projection_status_updated_at = verified_finalized_at
  where id = requested_event_id;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.mark_group_event_projection_availability(
  requested_event_id uuid,
  requested_program_address text,
  requested_event_pool_address text,
  requested_availability text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if requested_availability not in ('pending', 'unavailable') then
    raise exception using errcode = 'P0001', message = 'group event projection availability is invalid';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set
    projection_availability = requested_availability,
    projection_status_updated_at = pg_catalog.statement_timestamp()
  where id = requested_event_id
    and program_address = requested_program_address
    and event_pool_address = requested_event_pool_address
    and projection_availability <> 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event projection is unavailable';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.publish_owned_group_event(requested_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events as event
  set publication_status = 'published', published_at = pg_catalog.statement_timestamp()
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
    and event.coach_profile_id = profile_id_text::uuid
    and event.publication_status = 'draft'
    and event.projection_availability = 'current'
    and event.starts_at > pg_catalog.statement_timestamp()
    and exists (
      select 1
      from app.group_event_pool_projections as projection
      where projection.event_id = event.id
        and projection.run_id = event.run_id
        and projection.program_address = event.program_address
        and projection.event_pool_address = event.event_pool_address
    );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event is not ready to publish';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.withdraw_owned_group_event_draft(requested_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set publication_status = 'withdrawn', withdrawn_at = pg_catalog.statement_timestamp()
  where id = requested_event_id
    and run_id = run_id_text::uuid
    and coach_profile_id = profile_id_text::uuid
    and publication_status = 'draft'
    and projection_availability = 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event draft cannot be withdrawn';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.record_verified_group_event_contribution_projection(
  requested_event_id uuid,
  verified_program_address text,
  verified_event_pool_address text,
  verified_contribution_address text,
  verified_participant_wallet_address text,
  verified_amount_base_units bigint,
  verified_lifecycle_status text,
  verified_transaction_signature text,
  verified_observed_slot bigint,
  verified_finalized_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event record;
  selected_pool record;
  participant_profile_id_value uuid;
  existing_projection record;
  projection_id uuid;
begin
  if verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_contribution_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_participant_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_amount_base_units not between 1 and 9000000000000000
    or verified_lifecycle_status not in ('funded', 'refundable', 'refunded', 'successful')
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_observed_slot < 0
    or verified_finalized_at is null
  then
    raise exception using errcode = 'P0001', message = 'group event contribution evidence is invalid';
  end if;

  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);
  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id;
  select * into selected_pool
  from app.group_event_pool_projections as projection
  where projection.event_id = requested_event_id;
  if selected_event.id is null
    or selected_pool.event_id is null
    or selected_event.program_address <> verified_program_address
    or selected_event.event_pool_address <> verified_event_pool_address
    or selected_pool.seat_price_base_units <> verified_amount_base_units
  then
    raise exception using errcode = 'P0001', message = 'group event contribution does not match pool';
  end if;

  select binding.profile_id into participant_profile_id_value
  from app.wallet_bindings as binding
  where binding.run_id = selected_event.run_id
    and binding.cluster = 'solana:devnet'
    and binding.wallet_address = verified_participant_wallet_address
    and binding.status = 'active';
  if participant_profile_id_value is null then
    raise exception using errcode = 'P0001', message = 'group event participant wallet is not linked';
  end if;

  select * into existing_projection
  from app.group_event_contribution_projections as projection
  where projection.event_id = requested_event_id
    and projection.participant_wallet_address = verified_participant_wallet_address
  for update;
  if found then
    if verified_observed_slot < existing_projection.observed_slot
      or existing_projection.program_address <> verified_program_address
      or existing_projection.event_pool_address <> verified_event_pool_address
      or existing_projection.contribution_address <> verified_contribution_address
      or existing_projection.amount_base_units <> verified_amount_base_units
      or existing_projection.participant_profile_id <> participant_profile_id_value
      or not (
        (existing_projection.lifecycle_status = 'funded' and verified_lifecycle_status in ('funded', 'refundable', 'refunded', 'successful'))
        or (existing_projection.lifecycle_status = 'refundable' and verified_lifecycle_status in ('refundable', 'refunded'))
        or (existing_projection.lifecycle_status = 'refunded' and verified_lifecycle_status = 'refunded')
        or (existing_projection.lifecycle_status = 'successful' and verified_lifecycle_status = 'successful')
      )
    then
      raise exception using errcode = 'P0001', message = 'group event contribution evidence is stale or conflicting';
    end if;
    if verified_observed_slot = existing_projection.observed_slot then
      if existing_projection.lifecycle_status <> verified_lifecycle_status
        or existing_projection.transaction_signature <> verified_transaction_signature
        or existing_projection.finalized_at <> verified_finalized_at
      then
        raise exception using errcode = 'P0001', message = 'group event contribution conflicts at the same slot';
      end if;
    else
      update app.group_event_contribution_projections
      set
        lifecycle_status = verified_lifecycle_status,
        transaction_signature = verified_transaction_signature,
        observed_slot = verified_observed_slot,
        finalized_at = verified_finalized_at
      where id = existing_projection.id;
    end if;
    projection_id := existing_projection.id;
  else
    insert into app.group_event_contribution_projections (
      run_id,
      event_id,
      participant_profile_id,
      program_address,
      event_pool_address,
      contribution_address,
      participant_wallet_address,
      amount_base_units,
      lifecycle_status,
      transaction_signature,
      observed_slot,
      finalized_at
    ) values (
      selected_event.run_id,
      requested_event_id,
      participant_profile_id_value,
      verified_program_address,
      verified_event_pool_address,
      verified_contribution_address,
      verified_participant_wallet_address,
      verified_amount_base_units,
      verified_lifecycle_status,
      verified_transaction_signature,
      verified_observed_slot,
      verified_finalized_at
    ) returning id into projection_id;
  end if;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return projection_id;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

alter function app.create_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) owner to app_owner;
alter function app.update_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) owner to app_owner;
alter function app.bind_owned_group_event_pool(uuid, text, text)
  owner to app_owner;
alter function app.record_verified_group_event_pool_projection(
  uuid, text, text, text, text, text, text, text, bigint, smallint, smallint,
  smallint, timestamptz, timestamptz, timestamptz, text, text, bigint,
  timestamptz
) owner to app_owner;
alter function app.mark_group_event_projection_availability(uuid, text, text, text)
  owner to app_owner;
alter function app.publish_owned_group_event(uuid) owner to app_owner;
alter function app.withdraw_owned_group_event_draft(uuid) owner to app_owner;
alter function app.record_verified_group_event_contribution_projection(
  uuid, text, text, text, text, bigint, text, text, bigint, timestamptz
) owner to app_owner;

revoke all on function app.create_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function app.update_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function app.bind_owned_group_event_pool(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function app.record_verified_group_event_pool_projection(
  uuid, text, text, text, text, text, text, text, bigint, smallint, smallint,
  smallint, timestamptz, timestamptz, timestamptz, text, text, bigint,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app.mark_group_event_projection_availability(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function app.publish_owned_group_event(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.withdraw_owned_group_event_draft(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.record_verified_group_event_contribution_projection(
  uuid, text, text, text, text, bigint, text, text, bigint, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function app.create_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) to app_runtime;
grant execute on function app.update_owned_group_event_draft(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) to app_runtime;
grant execute on function app.bind_owned_group_event_pool(uuid, text, text)
  to app_runtime;
grant execute on function app.record_verified_group_event_pool_projection(
  uuid, text, text, text, text, text, text, text, bigint, smallint, smallint,
  smallint, timestamptz, timestamptz, timestamptz, text, text, bigint,
  timestamptz
) to app_runtime;
grant execute on function app.mark_group_event_projection_availability(uuid, text, text, text)
  to app_runtime;
grant execute on function app.publish_owned_group_event(uuid) to app_runtime;
grant execute on function app.withdraw_owned_group_event_draft(uuid) to app_runtime;
grant execute on function app.record_verified_group_event_contribution_projection(
  uuid, text, text, text, text, bigint, text, text, bigint, timestamptz
) to app_runtime;

comment on table app.group_events is
  'Coach-owned event metadata and immutable coach/location snapshots; never financial authority.';
comment on table app.group_event_pool_projections is
  'Last finalized EventPool projection supplied by the trusted DEV0122 verifier.';
comment on table app.group_event_contribution_projections is
  'Actor-scoped finalized Contribution projections; never a public participant list.';
comment on column app.group_events.source_proposal_id is
  'Optional non-authoritative proposal UUID; DEV0118 may add referential integrity later.';
