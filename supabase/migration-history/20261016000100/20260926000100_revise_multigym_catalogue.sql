-- Retire the exact private DEV0067 fixture drafts when this migration is
-- applied to a database that has already been seeded. Clean resets run the
-- revised seed only after every migration, so these statements are also safe
-- when no fixture rows exist yet.
delete from app.membership_product_versions
where id in (
  '61000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000002'
)
  and status = 'draft';

update app.membership_products
set status = 'retired'
where id in (
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002'
)
  and record_source = 'fixture'
  and slug in ('annual-unlimited', 'six-month-flex-12');

-- Replace the remaining legacy real-world-inspired fixture name in existing
-- local datasets while keeping its stable identifiers and authority links.
update app.profiles
set slug = 'sam-lee',
    display_name = 'Sam Lee',
    initials = 'SL',
    bio = 'Muay Thai coach at Northside Combat'
where id = '10000000-0000-4000-8000-000000000005'
  and record_source = 'fixture';

update app.organizations
set slug = 'northside-combat',
    name = 'Northside Combat',
    description = 'Technique-led Muay Thai in Kreuzberg.'
where id = '30000000-0000-4000-8000-000000000001'
  and record_source = 'fixture';

update app.venues
set slug = 'northside-combat',
    name = 'Northside Combat',
    description = 'Technique-led Muay Thai, welcoming pad rounds and a steady path from first class to confident combinations.'
where id = '40000000-0000-4000-8000-000000000001'
  and record_source = 'fixture';

alter table app.membership_products
  add column scope text not null default 'organization';

alter table app.membership_products
  alter column organization_id drop not null;

alter table app.membership_products
  add constraint membership_products_scope_check
    check (scope in ('platform', 'organization')),
  add constraint membership_products_scope_organization_check
    check (
      (scope = 'platform' and organization_id is null)
      or (scope = 'organization' and organization_id is not null)
    ),
  add constraint membership_products_run_slug_key unique (run_id, slug),
  add constraint membership_products_run_id_scope_key
    unique (run_id, id, scope);

alter table app.membership_product_versions
  rename column initial_entry_allowance to included_checkins;

alter table app.membership_product_versions
  add column plan_code text null,
  add column period_policy text not null default 'fixed_seconds',
  add column max_included_checkins_per_day integer null,
  add column required_core_gym_count integer null,
  add column non_core_visit_price_base_units numeric(20, 0) null;

alter table app.membership_product_versions
  alter column duration_seconds drop not null,
  drop constraint membership_product_versions_access_model_check,
  drop constraint membership_product_versions_access_terms_check;

alter table app.membership_product_versions
  add constraint membership_product_versions_plan_code_check
    check (plan_code is null or plan_code in ('basic', 'classic')),
  add constraint membership_product_versions_period_policy_check
    check (period_policy in ('fixed_seconds', 'calendar_month')),
  add constraint membership_product_versions_access_model_check
    check (
      access_model in (
        'unlimited',
        'entry_limited',
        'limited',
        'daily_uncapped'
      )
    ),
  add constraint membership_product_versions_current_price_check
    check (
      plan_code is null
      or (plan_code = 'basic' and price_base_units = 80000000)
      or (plan_code = 'classic' and price_base_units = 150000000)
    ),
  add constraint membership_product_versions_access_terms_check
    check (
      (
        plan_code is null
        and period_policy = 'fixed_seconds'
        and max_included_checkins_per_day is null
        and required_core_gym_count is null
        and non_core_visit_price_base_units is null
        and (
          (
            access_model = 'unlimited'
            and duration_seconds = 31536000
            and included_checkins is null
          )
          or (
            access_model = 'entry_limited'
            and duration_seconds = 15811200
            and included_checkins = 12
          )
        )
      )
      or (
        plan_code = 'basic'
        and period_policy = 'calendar_month'
        and duration_seconds is null
        and access_model = 'limited'
        and included_checkins = 10
        and max_included_checkins_per_day = 1
        and required_core_gym_count = 4
        and non_core_visit_price_base_units = 15000000
        and not transferable
        and transfer_fee_base_units = 0
        and minimum_hold_seconds = 0
        and minimum_remaining_transfer_seconds = 0
      )
      or (
        plan_code = 'classic'
        and period_policy = 'calendar_month'
        and duration_seconds is null
        and access_model = 'daily_uncapped'
        and included_checkins is null
        and max_included_checkins_per_day = 1
        and required_core_gym_count = 4
        and non_core_visit_price_base_units = 15000000
        and not transferable
        and transfer_fee_base_units = 0
        and minimum_hold_seconds = 0
        and minimum_remaining_transfer_seconds = 0
      )
    );

create unique index membership_product_versions_one_published_plan_code_idx
  on app.membership_product_versions (run_id, plan_code)
  where status = 'published' and plan_code is not null;

create or replace function app.enforce_membership_product_version_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using
        errcode = '23514',
        message = 'membership product versions must be created as drafts';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using
        errcode = '23514',
        message = 'published or retired membership product versions cannot be deleted';
    end if;
    return old;
  end if;

  if old.status = 'retired' then
    raise exception using
      errcode = '23514',
      message = 'retired membership product versions are immutable';
  end if;

  if old.status = 'draft' and new.status = 'retired' then
    raise exception using
      errcode = '23514',
      message = 'draft membership product versions must be published before retirement';
  end if;

  if old.status = 'published' then
    if new.status not in ('published', 'retired') then
      raise exception using
        errcode = '23514',
        message = 'published membership product versions cannot return to draft';
    end if;

    if new.id is distinct from old.id
      or new.run_id is distinct from old.run_id
      or new.product_id is distinct from old.product_id
      or new.version_number is distinct from old.version_number
      or new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.currency_code is distinct from old.currency_code
      or new.price_base_units is distinct from old.price_base_units
      or new.duration_seconds is distinct from old.duration_seconds
      or new.access_model is distinct from old.access_model
      or new.included_checkins is distinct from old.included_checkins
      or new.transferable is distinct from old.transferable
      or new.transfer_fee_base_units is distinct from old.transfer_fee_base_units
      or new.minimum_hold_seconds is distinct from old.minimum_hold_seconds
      or new.minimum_remaining_transfer_seconds is distinct from old.minimum_remaining_transfer_seconds
      or new.plan_code is distinct from old.plan_code
      or new.period_policy is distinct from old.period_policy
      or new.max_included_checkins_per_day is distinct from old.max_included_checkins_per_day
      or new.required_core_gym_count is distinct from old.required_core_gym_count
      or new.non_core_visit_price_base_units is distinct from old.non_core_visit_price_base_units
      or new.published_at is distinct from old.published_at
      or new.created_by_profile_id is distinct from old.created_by_profile_id
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '23514',
        message = 'published membership product terms are immutable';
    end if;
  end if;

  return new;
end;
$$;

alter table app.venues
  drop constraint venues_activity_tags_check;

alter table app.venues
  add constraint venues_activity_tags_check
    check (
      cardinality(activity_tags) > 0
      and activity_tags <@ array[
        'Grappling',
        'Kickboxing',
        'Massage',
        'MMA',
        'Muay Thai',
        'Running',
        'Strength',
        'Wellness',
        'Yoga'
      ]::text[]
    );

create table app.participating_gyms (
  run_id uuid not null,
  venue_id uuid not null,
  artwork_key text not null,
  coach_names text[] not null,
  map_label text not null,
  map_address text not null,
  map_latitude numeric(10, 7) not null,
  map_longitude numeric(10, 7) not null,
  supports_non_core_visit boolean not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participating_gyms_pkey primary key (run_id, venue_id),
  constraint participating_gyms_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id) on delete restrict,
  constraint participating_gyms_artwork_key_check
    check (
      artwork_key in ('fight', 'flow', 'ground', 'night', 'recovery', 'strength')
    ),
  constraint participating_gyms_coach_names_check
    check (
      cardinality(coach_names) > 0
      and array_position(coach_names, null) is null
    ),
  constraint participating_gyms_map_label_length_check
    check (char_length(map_label) between 2 and 160),
  constraint participating_gyms_map_address_length_check
    check (char_length(map_address) between 5 and 240),
  constraint participating_gyms_map_latitude_check
    check (map_latitude between -90 and 90),
  constraint participating_gyms_map_longitude_check
    check (map_longitude between -180 and 180),
  constraint participating_gyms_status_check
    check (status in ('active', 'inactive'))
);

create index participating_gyms_run_status_idx
  on app.participating_gyms (run_id, status);

create table app.membership_product_gym_eligibility (
  run_id uuid not null,
  product_id uuid not null,
  product_scope text not null default 'platform',
  venue_id uuid not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_product_gym_eligibility_pkey
    primary key (run_id, product_id, venue_id),
  constraint membership_product_gym_eligibility_product_fkey
    foreign key (run_id, product_id, product_scope)
    references app.membership_products (run_id, id, scope)
    on delete restrict,
  constraint membership_product_gym_eligibility_venue_fkey
    foreign key (run_id, venue_id)
    references app.participating_gyms (run_id, venue_id)
    on delete restrict,
  constraint membership_product_gym_eligibility_scope_check
    check (product_scope = 'platform'),
  constraint membership_product_gym_eligibility_status_check
    check (status in ('active', 'inactive'))
);

create index membership_product_gym_eligibility_run_venue_status_idx
  on app.membership_product_gym_eligibility (run_id, venue_id, status);

create trigger participating_gyms_set_updated_at
before update on app.participating_gyms
for each row execute function app.set_updated_at();

create trigger membership_product_gym_eligibility_set_updated_at
before update on app.membership_product_gym_eligibility
for each row execute function app.set_updated_at();

alter table app.participating_gyms enable row level security;
alter table app.participating_gyms force row level security;
alter table app.membership_product_gym_eligibility enable row level security;
alter table app.membership_product_gym_eligibility force row level security;

alter table app.participating_gyms owner to app_owner;
alter table app.membership_product_gym_eligibility owner to app_owner;

revoke all on app.participating_gyms
  from public, anon, authenticated, service_role;
revoke all on app.membership_product_gym_eligibility
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on app.participating_gyms to app_runtime;
grant select, insert, update, delete
  on app.membership_product_gym_eligibility to app_runtime;

comment on column app.membership_products.scope is
  'Platform plans have no issuing organization; organization scope is retained only for historical catalogue rows.';
comment on column app.membership_product_versions.plan_code is
  'Stable current-plan code for Basic or Classic; null marks a historical single-gym version shape.';
comment on table app.participating_gyms is
  'Membership-catalogue participation metadata over canonical venue identities; not a partnership, entitlement or access record.';
comment on table app.membership_product_gym_eligibility is
  'Current plan-to-participating-gym eligibility configuration; not a member selection or activated entitlement.';
