export const membershipPlanIds = ["basic", "classic"] as const;

export type MembershipPlanId = (typeof membershipPlanIds)[number];

export const disciplines = [
  "Grappling",
  "Kickboxing",
  "Massage",
  "MMA",
  "Muay Thai",
  "Strength",
  "Wellness",
  "Yoga",
] as const;

export type Discipline = (typeof disciplines)[number];

export type Money = {
  amount: number;
  currency: "EUR";
};

export type MembershipAccess =
  { model: "limited"; includedCheckins: number } | { model: "daily-uncapped" };

export type MembershipPlanSummary = {
  id: MembershipPlanId;
  version: string;
  name: string;
  price: Money;
  priceInterval: "month";
  access: MembershipAccess;
  maxIncludedCheckinsPerDay: 1;
  requiredCoreGyms: 4;
  nonCoreVisitPrice: Money;
  description: string;
};

export type PublicMapAnchor = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type GymSummary = {
  id: string;
  name: string;
  area: string;
  activities: Discipline[];
  coaches: string[];
  description: string;
  artwork: "fight" | "flow" | "ground" | "night" | "recovery" | "strength";
  eligiblePlans: MembershipPlanId[];
  supportsNonCoreVisit: boolean;
  mapAnchor: PublicMapAnchor;
  fixture: true;
};

// Kept as an alias while older presentation components migrate to GymSummary.
export type ClubStudio = GymSummary;

export type PublicCatalogue = {
  source: "preview-fixtures" | "persistent-catalogue";
  version: string;
  plans: MembershipPlanSummary[];
  gyms: GymSummary[];
};

export type PublicCatalogueResult =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; catalogue: PublicCatalogue };
