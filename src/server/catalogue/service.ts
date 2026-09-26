import "server-only";

import {
  disciplines,
  membershipPlanIds,
  type Discipline,
  type GymSummary,
  type MembershipPlanId,
  type MembershipPlanSummary,
  type PublicCatalogueResult,
} from "@/domain/catalogue";
import {
  readPublishedCatalogueRows,
  type PublicCatalogueProjectionRow,
} from "@/server/db/catalogue/repository";

const EURC_SCALE = 1_000_000;
const artworkKeys = new Set<GymSummary["artwork"]>([
  "fight",
  "flow",
  "ground",
  "night",
  "recovery",
  "strength",
]);
const disciplineSet = new Set<string>(disciplines);

type PlanAccumulator = {
  plan: MembershipPlanSummary;
  productSlug: string;
};

type GymAccumulator = {
  gym: Omit<GymSummary, "eligiblePlans">;
  eligiblePlans: Set<MembershipPlanId>;
};

function isPlanId(value: string): value is MembershipPlanId {
  return membershipPlanIds.includes(value as MembershipPlanId);
}

function displayEuros(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const baseUnits = Number(value);
  if (!Number.isSafeInteger(baseUnits) || baseUnits % EURC_SCALE !== 0) {
    return null;
  }
  const amount = baseUnits / EURC_SCALE;
  return amount > 0 ? amount : null;
}

function planFromRow(
  row: PublicCatalogueProjectionRow,
): MembershipPlanSummary | null {
  if (
    !isPlanId(row.plan_code) ||
    row.product_slug !== row.plan_code ||
    row.currency_code !== "EURC" ||
    row.period_policy !== "calendar_month" ||
    row.version_number < 1 ||
    row.max_included_checkins_per_day !== 1 ||
    row.required_core_gym_count !== 4
  ) {
    return null;
  }
  const price = displayEuros(row.price_base_units);
  const nonCorePrice = displayEuros(row.non_core_visit_price_base_units);
  if (price !== (row.plan_code === "basic" ? 80 : 150) || nonCorePrice !== 15) {
    return null;
  }

  const access =
    row.plan_code === "basic" &&
    row.access_model === "limited" &&
    row.included_checkins === 10
      ? ({ model: "limited", includedCheckins: 10 } as const)
      : row.plan_code === "classic" &&
          row.access_model === "daily_uncapped" &&
          row.included_checkins === null
        ? ({ model: "daily-uncapped" } as const)
        : null;
  if (!access) return null;

  return {
    id: row.plan_code,
    version: String(row.version_number),
    name: row.plan_name,
    description: row.plan_description,
    price: { amount: price, currency: "EUR" },
    priceInterval: "month",
    access,
    maxIncludedCheckinsPerDay: 1,
    requiredCoreGyms: 4,
    nonCoreVisitPrice: { amount: nonCorePrice, currency: "EUR" },
  };
}

function gymFromRow(
  row: PublicCatalogueProjectionRow,
): Omit<GymSummary, "eligiblePlans"> | null {
  const latitude = Number(row.map_latitude);
  const longitude = Number(row.map_longitude);
  if (
    !row.venue_slug ||
    !row.venue_name ||
    !row.venue_area ||
    !row.venue_description ||
    !artworkKeys.has(row.artwork_key as GymSummary["artwork"]) ||
    !row.coach_names.length ||
    !row.activity_tags.length ||
    !row.activity_tags.every((tag) => disciplineSet.has(tag)) ||
    !row.map_label ||
    !row.map_address.endsWith("Berlin") ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    id: row.venue_slug,
    name: row.venue_name,
    area: row.venue_area,
    activities: row.activity_tags as Discipline[],
    coaches: row.coach_names,
    description: row.venue_description,
    artwork: row.artwork_key as GymSummary["artwork"],
    supportsNonCoreVisit: row.supports_non_core_visit,
    mapAnchor: {
      label: row.map_label,
      address: row.map_address,
      latitude,
      longitude,
    },
    fixture: true,
  };
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function catalogueResultFromRows(
  rows: readonly PublicCatalogueProjectionRow[],
): PublicCatalogueResult {
  if (!rows.length) return { status: "empty" };

  const runSlugs = new Set(rows.map((row) => row.run_slug));
  const plans = new Map<MembershipPlanId, PlanAccumulator>();
  const gyms = new Map<string, GymAccumulator>();

  for (const row of rows) {
    if (!isPlanId(row.plan_code)) {
      return { status: "error", message: "The gym catalogue is inconsistent." };
    }
    const plan = planFromRow(row);
    const gym = gymFromRow(row);
    if (!plan || !gym) {
      return { status: "error", message: "The gym catalogue is inconsistent." };
    }

    const previousPlan = plans.get(plan.id);
    if (
      previousPlan &&
      (!sameValue(previousPlan.plan, plan) ||
        previousPlan.productSlug !== row.product_slug)
    ) {
      return { status: "error", message: "The gym catalogue is inconsistent." };
    }
    plans.set(plan.id, { plan, productSlug: row.product_slug });

    const previousGym = gyms.get(gym.id);
    if (previousGym && !sameValue(previousGym.gym, gym)) {
      return { status: "error", message: "The gym catalogue is inconsistent." };
    }
    const entry = previousGym ?? { gym, eligiblePlans: new Set() };
    entry.eligiblePlans.add(plan.id);
    gyms.set(gym.id, entry);
  }

  if (
    runSlugs.size !== 1 ||
    plans.size !== membershipPlanIds.length ||
    membershipPlanIds.some((planId) => !plans.has(planId)) ||
    !gyms.size
  ) {
    return { status: "error", message: "The gym catalogue is inconsistent." };
  }

  const publicPlans = membershipPlanIds.map(
    (planId) => plans.get(planId)!.plan,
  );
  const publicGyms = Array.from(gyms.values())
    .map(({ gym, eligiblePlans }): GymSummary => ({
      ...gym,
      eligiblePlans: membershipPlanIds.filter((planId) =>
        eligiblePlans.has(planId),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const catalogueFingerprint = publicGyms
    .map((gym) => `${gym.id}-${gym.eligiblePlans.join("+")}`)
    .join(",");

  return {
    status: "ready",
    catalogue: {
      source: "persistent-catalogue",
      version: `${Array.from(runSlugs)[0]}:${publicPlans
        .map((plan) => `${plan.id}-v${plan.version}`)
        .join(":")}:${catalogueFingerprint}`,
      plans: publicPlans,
      gyms: publicGyms,
    },
  };
}

export async function currentPublicCatalogue(): Promise<PublicCatalogueResult> {
  try {
    return catalogueResultFromRows(await readPublishedCatalogueRows());
  } catch {
    return {
      status: "error",
      message:
        "The gym catalogue is temporarily unavailable. Please try again.",
    };
  }
}
