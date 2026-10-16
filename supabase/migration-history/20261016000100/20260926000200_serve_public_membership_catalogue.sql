-- The server runtime may read only the active public catalogue. Browser-facing
-- Supabase roles retain no app-schema access, and catalogue writes remain
-- migration/seed managed for the hackathon.
revoke insert, update, delete
  on app.membership_products,
     app.membership_product_versions,
     app.participating_gyms,
     app.membership_product_gym_eligibility
  from app_runtime;

grant select
  on app.demo_runs,
     app.venues,
     app.membership_products,
     app.membership_product_versions,
     app.participating_gyms,
     app.membership_product_gym_eligibility
  to app_runtime;

create policy demo_runs_public_catalogue_select
  on app.demo_runs
  for select
  to app_runtime
  using (
    status = 'active'
    and catalogue_visibility = 'public'
  );

create policy membership_products_public_catalogue_select
  on app.membership_products
  for select
  to app_runtime
  using (
    scope = 'platform'
    and status = 'active'
    and exists (
      select 1
      from app.demo_runs run
      where run.id = membership_products.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
  );

create policy membership_product_versions_public_catalogue_select
  on app.membership_product_versions
  for select
  to app_runtime
  using (
    status = 'published'
    and exists (
      select 1
      from app.membership_products product
      where product.run_id = membership_product_versions.run_id
        and product.id = membership_product_versions.product_id
        and product.scope = 'platform'
        and product.status = 'active'
    )
  );

create policy participating_gyms_public_catalogue_select
  on app.participating_gyms
  for select
  to app_runtime
  using (
    status = 'active'
    and exists (
      select 1
      from app.demo_runs run
      where run.id = participating_gyms.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
  );

create policy venues_public_catalogue_select
  on app.venues
  for select
  to app_runtime
  using (
    status = 'active'
    and exists (
      select 1
      from app.participating_gyms participating_gym
      where participating_gym.run_id = venues.run_id
        and participating_gym.venue_id = venues.id
        and participating_gym.status = 'active'
    )
  );

create policy membership_product_gym_eligibility_public_catalogue_select
  on app.membership_product_gym_eligibility
  for select
  to app_runtime
  using (
    product_scope = 'platform'
    and status = 'active'
    and exists (
      select 1
      from app.membership_products product
      where product.run_id = membership_product_gym_eligibility.run_id
        and product.id = membership_product_gym_eligibility.product_id
        and product.scope = 'platform'
        and product.status = 'active'
    )
    and exists (
      select 1
      from app.participating_gyms participating_gym
      where participating_gym.run_id = membership_product_gym_eligibility.run_id
        and participating_gym.venue_id = membership_product_gym_eligibility.venue_id
        and participating_gym.status = 'active'
    )
  );

comment on policy demo_runs_public_catalogue_select on app.demo_runs is
  'Lets the restricted server runtime resolve the one active public catalogue dataset without an actor context.';
comment on policy membership_products_public_catalogue_select on app.membership_products is
  'Read-only server projection input for active platform catalogue products.';
comment on policy membership_product_versions_public_catalogue_select on app.membership_product_versions is
  'Read-only server projection input for published versions of visible platform products.';
comment on policy participating_gyms_public_catalogue_select on app.participating_gyms is
  'Read-only server projection input for active participating-gym metadata.';
comment on policy venues_public_catalogue_select on app.venues is
  'Read-only server projection input for active venues in the participating-gym catalogue.';
comment on policy membership_product_gym_eligibility_public_catalogue_select on app.membership_product_gym_eligibility is
  'Read-only server projection input for active plan-to-gym eligibility.';
