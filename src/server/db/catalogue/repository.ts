import "server-only";

import { withDatabaseConnection } from "@/server/db/client";

export type PublicCatalogueProjectionRow = Readonly<{
  run_slug: string;
  product_slug: string;
  version_number: number;
  plan_code: string;
  plan_name: string;
  plan_description: string;
  currency_code: string;
  price_base_units: string;
  period_policy: string;
  access_model: string;
  included_checkins: number | null;
  max_included_checkins_per_day: number | null;
  required_core_gym_count: number | null;
  non_core_visit_price_base_units: string | null;
  venue_slug: string;
  venue_name: string;
  venue_area: string;
  venue_description: string;
  activity_tags: string[];
  artwork_key: string;
  coach_names: string[];
  map_label: string;
  map_address: string;
  map_latitude: string;
  map_longitude: string;
  supports_non_core_visit: boolean;
}>;

export function readPublishedCatalogueRows() {
  return withDatabaseConnection(
    ({ queryClient }) => queryClient<PublicCatalogueProjectionRow[]>`
    select
      run.slug as run_slug,
      product.slug as product_slug,
      version.version_number,
      version.plan_code,
      version.name as plan_name,
      version.description as plan_description,
      version.currency_code,
      version.price_base_units::text,
      version.period_policy,
      version.access_model,
      version.included_checkins,
      version.max_included_checkins_per_day,
      version.required_core_gym_count,
      version.non_core_visit_price_base_units::text,
      venue.slug as venue_slug,
      venue.name as venue_name,
      venue.area as venue_area,
      venue.description as venue_description,
      venue.activity_tags,
      participating_gym.artwork_key,
      participating_gym.coach_names,
      participating_gym.map_label,
      participating_gym.map_address,
      participating_gym.map_latitude::text,
      participating_gym.map_longitude::text,
      participating_gym.supports_non_core_visit
    from app.demo_runs run
    join app.membership_products product
      on product.run_id = run.id
    join app.membership_product_versions version
      on version.run_id = product.run_id
      and version.product_id = product.id
    join app.membership_product_gym_eligibility eligibility
      on eligibility.run_id = product.run_id
      and eligibility.product_id = product.id
      and eligibility.product_scope = product.scope
    join app.participating_gyms participating_gym
      on participating_gym.run_id = eligibility.run_id
      and participating_gym.venue_id = eligibility.venue_id
    join app.venues venue
      on venue.run_id = participating_gym.run_id
      and venue.id = participating_gym.venue_id
    where run.status = 'active'
      and run.catalogue_visibility = 'public'
      and product.scope = 'platform'
      and product.status = 'active'
      and version.status = 'published'
      and eligibility.status = 'active'
      and participating_gym.status = 'active'
      and venue.status = 'active'
    order by version.plan_code, venue.slug
  `,
  );
}
