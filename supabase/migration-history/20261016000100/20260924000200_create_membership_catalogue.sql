create table app.membership_products (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  organization_id uuid not null,
  slug text not null,
  status text not null,
  record_source text not null,
  created_by_profile_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_products_run_organization_fkey
    foreign key (run_id, organization_id)
    references app.organizations (run_id, id) on delete restrict,
  constraint membership_products_creator_fkey
    foreign key (run_id, created_by_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint membership_products_run_id_id_key unique (run_id, id),
  constraint membership_products_run_organization_slug_key
    unique (run_id, organization_id, slug),
  constraint membership_products_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint membership_products_status_check
    check (status in ('active', 'retired')),
  constraint membership_products_record_source_check
    check (record_source in ('fixture', 'user')),
  constraint membership_products_creator_source_check
    check (
      (record_source = 'fixture' and created_by_profile_id is null)
      or (record_source = 'user' and created_by_profile_id is not null)
    )
);

create index membership_products_run_organization_status_idx
  on app.membership_products (run_id, organization_id, status);

create table app.membership_product_versions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  product_id uuid not null,
  version_number integer not null,
  name text not null,
  description text not null,
  currency_code text not null,
  price_base_units numeric(20, 0) null,
  duration_seconds integer not null,
  access_model text not null,
  initial_entry_allowance integer null,
  transferable boolean not null,
  transfer_fee_base_units numeric(20, 0) not null,
  minimum_hold_seconds integer not null,
  minimum_remaining_transfer_seconds integer not null,
  status text not null,
  published_at timestamptz null,
  retired_at timestamptz null,
  created_by_profile_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_product_versions_product_fkey
    foreign key (run_id, product_id)
    references app.membership_products (run_id, id) on delete restrict,
  constraint membership_product_versions_creator_fkey
    foreign key (run_id, created_by_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint membership_product_versions_run_id_id_key unique (run_id, id),
  constraint membership_product_versions_product_version_key
    unique (run_id, product_id, version_number),
  constraint membership_product_versions_version_check
    check (version_number > 0),
  constraint membership_product_versions_name_length_check
    check (char_length(name) between 2 and 120),
  constraint membership_product_versions_description_length_check
    check (char_length(description) between 1 and 2000),
  constraint membership_product_versions_currency_check
    check (currency_code = 'EURC'),
  constraint membership_product_versions_price_check
    check (
      price_base_units is null
      or (
        price_base_units >= 0
        and price_base_units <= 18446744073709551615
      )
    ),
  constraint membership_product_versions_access_model_check
    check (access_model in ('unlimited', 'entry_limited')),
  constraint membership_product_versions_access_terms_check
    check (
      (
        access_model = 'unlimited'
        and duration_seconds = 31536000
        and initial_entry_allowance is null
      )
      or (
        access_model = 'entry_limited'
        and duration_seconds = 15811200
        and initial_entry_allowance = 12
      )
    ),
  constraint membership_product_versions_transfer_terms_check
    check (
      (
        transferable
        and transfer_fee_base_units = 10000000
        and minimum_hold_seconds = 2592000
        and minimum_remaining_transfer_seconds = 2592000
      )
      or (
        not transferable
        and transfer_fee_base_units = 0
        and minimum_hold_seconds = 0
        and minimum_remaining_transfer_seconds = 0
      )
    ),
  constraint membership_product_versions_status_check
    check (status in ('draft', 'published', 'retired')),
  constraint membership_product_versions_lifecycle_check
    check (
      (
        status = 'draft'
        and published_at is null
        and retired_at is null
      )
      or (
        status = 'published'
        and price_base_units is not null
        and published_at is not null
        and retired_at is null
      )
      or (
        status = 'retired'
        and price_base_units is not null
        and published_at is not null
        and retired_at is not null
        and retired_at >= published_at
      )
    )
);

create index membership_product_versions_run_product_status_idx
  on app.membership_product_versions (run_id, product_id, status);

create unique index membership_product_versions_one_published_idx
  on app.membership_product_versions (run_id, product_id)
  where status = 'published';

create function app.enforce_membership_product_version_lifecycle()
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
      or new.initial_entry_allowance is distinct from old.initial_entry_allowance
      or new.transferable is distinct from old.transferable
      or new.transfer_fee_base_units is distinct from old.transfer_fee_base_units
      or new.minimum_hold_seconds is distinct from old.minimum_hold_seconds
      or new.minimum_remaining_transfer_seconds is distinct from old.minimum_remaining_transfer_seconds
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

create trigger membership_product_versions_enforce_lifecycle
before insert or update or delete on app.membership_product_versions
for each row execute function app.enforce_membership_product_version_lifecycle();

create trigger membership_products_set_updated_at
before update on app.membership_products
for each row execute function app.set_updated_at();

create trigger membership_product_versions_set_updated_at
before update on app.membership_product_versions
for each row execute function app.set_updated_at();

alter table app.membership_products enable row level security;
alter table app.membership_products force row level security;
alter table app.membership_product_versions enable row level security;
alter table app.membership_product_versions force row level security;

alter table app.membership_products owner to app_owner;
alter table app.membership_product_versions owner to app_owner;
alter function app.enforce_membership_product_version_lifecycle() owner to app_owner;

revoke all on app.membership_products
  from public, anon, authenticated, service_role;
revoke all on app.membership_product_versions
  from public, anon, authenticated, service_role;
revoke all on function app.enforce_membership_product_version_lifecycle()
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on app.membership_products to app_runtime;
grant select, insert, update, delete on app.membership_product_versions
  to app_runtime;
grant execute on function app.enforce_membership_product_version_lifecycle()
  to app_runtime;

comment on table app.membership_products is
  'Stable fitness-business membership catalogue identities; not customer ownership or access.';
comment on table app.membership_product_versions is
  'Versioned membership offers with frozen published terms; not purchased entitlements.';
