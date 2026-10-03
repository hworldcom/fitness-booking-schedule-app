export const COACH_DISCIPLINES = Object.freeze([
  "Boxing",
  "Muay Thai",
  "Kickboxing",
  "Brazilian Jiu-Jitsu",
  "MMA",
  "Wrestling",
] as const);

export type CoachDiscipline = (typeof COACH_DISCIPLINES)[number];
export type CoachVisibility = "visible" | "hidden";
export type CoachLocationSource = "manual" | "permanent-geocoding";

export type CoachDirectoryFilters = Readonly<{
  query: string;
  discipline: CoachDiscipline | null;
  location: string;
  serviceMode: "private-training" | null;
}>;

export type CoachProfileInput = Readonly<{
  displayName: string;
  bio: string;
  disciplines: readonly CoachDiscipline[];
  timezone: string;
  visibility: CoachVisibility;
  selectedGymId: string | null;
  independentLocation: Readonly<{
    label: string;
    latitude: number;
    longitude: number;
    source: CoachLocationSource;
    provider: string | null;
  }> | null;
}>;

export type CoachProjection = Readonly<{
  profileId: string;
  slug: string;
  displayName: string;
  bio: string;
  serviceMode: "private-training";
  timezone: string;
  selectedGymId: string | null;
  gymName: string | null;
  location: Readonly<{
    kind: "gym" | "independent";
    label: string;
    latitude: number;
    longitude: number;
    source: "fixture" | "manual" | "permanent-geocoding";
    provider: string | null;
    confirmedAt: string;
  }>;
  visibility: "visible" | "hidden";
  recordSource: "fixture" | "user";
  disciplines: readonly CoachDiscipline[];
}>;

export type CoachGymOption = Readonly<{
  id: string;
  name: string;
  locationLabel: string;
  timezone: string;
}>;

export type CoachDirectoryState =
  | Readonly<{
      status: "ready";
      coaches: readonly CoachProjection[];
      filters: CoachDirectoryFilters;
    }>
  | Readonly<{ status: "unavailable"; filters: CoachDirectoryFilters }>;

export type PublicCoachProfileState =
  | Readonly<{ status: "ready"; coach: CoachProjection }>
  | Readonly<{ status: "not-found" | "unavailable" }>;

export type CoachEditorState =
  | Readonly<{
      status: "authorized";
      coach: CoachProjection | null;
      gyms: readonly CoachGymOption[];
      ownerDisplayName: string;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type CoachProfileInputResult =
  | Readonly<{ valid: true; value: CoachProfileInput }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeSingleLine(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : "";
}

function normalizeParagraph(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : "";
}

function isCoachDiscipline(value: unknown): value is CoachDiscipline {
  return (
    typeof value === "string" &&
    COACH_DISCIPLINES.some((discipline) => discipline === value)
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function finiteCoordinate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCoachDirectoryFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): CoachDirectoryFilters {
  const query = normalizeSingleLine(firstValue(searchParams.q)).slice(0, 80);
  const location = normalizeSingleLine(firstValue(searchParams.location)).slice(
    0,
    120,
  );
  const disciplineValue = firstValue(searchParams.discipline);
  const serviceValue = firstValue(searchParams.service);
  return Object.freeze({
    query,
    discipline: isCoachDiscipline(disciplineValue) ? disciplineValue : null,
    location,
    serviceMode:
      serviceValue === "private-training" ? "private-training" : null,
  });
}

export function validateCoachProfileInput(input: {
  displayName?: unknown;
  bio?: unknown;
  disciplines?: readonly unknown[];
  timezone?: unknown;
  visibility?: unknown;
  selectedGymId?: unknown;
  locationLabel?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationSource?: unknown;
  locationProvider?: unknown;
}): CoachProfileInputResult {
  const errors: string[] = [];
  const displayName = normalizeSingleLine(input.displayName);
  const bio = normalizeParagraph(input.bio);
  const timezone = normalizeSingleLine(input.timezone);
  const visibility = input.visibility;
  const selectedGymId = normalizeSingleLine(input.selectedGymId) || null;
  const requestedDisciplines = input.disciplines ?? [];
  const disciplines = Array.from(
    new Set(requestedDisciplines.filter(isCoachDiscipline)),
  );

  if (displayName.length < 2 || displayName.length > 80) {
    errors.push("Display name must be between 2 and 80 characters.");
  }
  if (bio.length < 40 || bio.length > 1200) {
    errors.push("Biography must be between 40 and 1,200 characters.");
  }
  if (
    disciplines.length < 1 ||
    disciplines.length > 4 ||
    disciplines.length !== requestedDisciplines.length
  ) {
    errors.push("Choose between one and four supported disciplines.");
  }
  if (
    timezone.length < 3 ||
    timezone.length > 80 ||
    !/^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*)$/.test(
      timezone,
    )
  ) {
    errors.push("Choose a valid IANA timezone such as Europe/Berlin.");
  }
  if (visibility !== "visible" && visibility !== "hidden") {
    errors.push("Choose whether the coach profile is visible or hidden.");
  }
  if (selectedGymId && !isUuid(selectedGymId)) {
    errors.push("The selected gym is invalid.");
  }

  let independentLocation: CoachProfileInput["independentLocation"] = null;
  if (!selectedGymId) {
    const label = normalizeSingleLine(input.locationLabel);
    const latitude = finiteCoordinate(input.latitude);
    const longitude = finiteCoordinate(input.longitude);
    const source = input.locationSource;
    const provider = normalizeSingleLine(input.locationProvider) || null;

    if (label.length < 2 || label.length > 240) {
      errors.push(
        "Public location label must be between 2 and 240 characters.",
      );
    }
    if (latitude === null || latitude < -90 || latitude > 90) {
      errors.push("Latitude must be between -90 and 90.");
    }
    if (longitude === null || longitude < -180 || longitude > 180) {
      errors.push("Longitude must be between -180 and 180.");
    }
    if (source !== "manual" && source !== "permanent-geocoding") {
      errors.push("The public location source is invalid.");
    }
    if (source === "manual" && provider !== null) {
      errors.push("Manual locations cannot claim a geocoding provider.");
    }
    if (
      source === "permanent-geocoding" &&
      (!provider || !/^[a-z0-9-]{2,40}$/.test(provider))
    ) {
      errors.push("Permanent geocoding requires a valid provider label.");
    }
    if (
      label.length >= 2 &&
      label.length <= 240 &&
      latitude !== null &&
      longitude !== null &&
      (source === "manual" || source === "permanent-geocoding")
    ) {
      independentLocation = Object.freeze({
        label,
        latitude,
        longitude,
        source,
        provider,
      });
    }
  }

  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({
      displayName,
      bio,
      disciplines: Object.freeze(disciplines),
      timezone,
      visibility: visibility as CoachVisibility,
      selectedGymId,
      independentLocation,
    }),
  });
}

export function isCoachPublicSlug(value: string) {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}
