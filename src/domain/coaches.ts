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
export type CoachApplicationStatus =
  "pending" | "approved" | "rejected" | "suspended";
export type CoachAccessStatus = "not-applied" | CoachApplicationStatus | "demo";
export type CoachTrustKind = "verified" | "demo";
export type CoachAccessProjection = Readonly<{
  status: CoachAccessStatus;
  submittedAt: string | null;
  decisionReason: string | null;
  verificationPolicyVersion: string | null;
}>;
export type CoachLocationSource = "manual" | "permanent-geocoding";
export const COACH_AVAILABILITY_DURATIONS = Object.freeze([
  30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
] as const);
export type CoachAvailabilityDuration =
  (typeof COACH_AVAILABILITY_DURATIONS)[number];
export type CoachAvailabilityStatus = "open" | "held" | "booked" | "withdrawn";
export type CoachAvailabilityIsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  trustKind: CoachTrustKind | null;
  portraitUrl: string | null;
  disciplines: readonly CoachDiscipline[];
}>;

export type CoachAvailabilityLocationSnapshot = Readonly<{
  kind: "gym" | "independent";
  selectedGymId: string | null;
  gymName: string | null;
  label: string;
  latitude: number;
  longitude: number;
  source: "fixture" | "manual" | "permanent-geocoding";
  provider: string | null;
  confirmedAt: string;
}>;

export type PublicCoachAvailabilitySlot = Readonly<{
  id: string;
  startsAt: string;
  endsAt: string;
  coachTimezone: string;
  location: CoachAvailabilityLocationSnapshot;
}>;

export type OwnedCoachAvailabilitySlot = PublicCoachAvailabilitySlot &
  Readonly<{
    status: CoachAvailabilityStatus;
    recurrenceRuleId: string | null;
    recurrenceLocalDate: string | null;
  }>;

export type OwnedCoachAvailabilityRule = Readonly<{
  id: string;
  isoWeekday: CoachAvailabilityIsoWeekday;
  localStartTime: string;
  coachTimezone: string;
}>;

export type CoachAvailabilityRuleInput = Readonly<{
  isoWeekday: CoachAvailabilityIsoWeekday;
  localStartTime: string;
}>;

export type CoachAvailabilityRuleInputResult =
  | Readonly<{ valid: true; value: CoachAvailabilityRuleInput }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

export type CoachAvailabilityRuleSetInputResult =
  | Readonly<{
      valid: true;
      value: Readonly<{
        keys: readonly string[];
        rules: readonly CoachAvailabilityRuleInput[];
      }>;
    }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

export type CoachAvailabilityInput = Readonly<{
  localStart: string;
  durationMinutes: CoachAvailabilityDuration;
  refreshLocation: boolean;
}>;

export type CoachAvailabilityInputResult =
  | Readonly<{ valid: true; value: CoachAvailabilityInput }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

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
  | Readonly<{
      status: "ready";
      coach: CoachProjection;
      slots: readonly PublicCoachAvailabilitySlot[];
    }>
  | Readonly<{ status: "not-found" | "unavailable" }>;

export type CoachEditorState =
  | Readonly<{
      status: "authorized";
      coach: CoachProjection | null;
      gyms: readonly CoachGymOption[];
      ownerDisplayName: string;
      coachAccess: CoachAccessProjection;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type CoachAvailabilityWorkspaceState =
  | Readonly<{
      status: "authorized";
      coach: CoachProjection | null;
      rules: readonly OwnedCoachAvailabilityRule[];
      slots: readonly OwnedCoachAvailabilitySlot[];
      ownerDisplayName: string;
      coachAccess: CoachAccessProjection;
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

function isCoachAvailabilityDuration(
  value: number,
): value is CoachAvailabilityDuration {
  return COACH_AVAILABILITY_DURATIONS.some((duration) => duration === value);
}

function isValidLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match;
  const parts = [year, month, day, hour, minute].map(Number);
  const candidate = new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]),
  );
  return (
    candidate.getUTCFullYear() === parts[0] &&
    candidate.getUTCMonth() === parts[1] - 1 &&
    candidate.getUTCDate() === parts[2] &&
    candidate.getUTCHours() === parts[3] &&
    candidate.getUTCMinutes() === parts[4]
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
  locationConfirmation?: unknown;
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
    if (source === "permanent-geocoding" && provider !== "mapbox") {
      errors.push("Permanent geocoding requires a confirmed Mapbox result.");
    }
    if (input.locationConfirmation !== "confirmed") {
      errors.push("Confirm the public location before saving the profile.");
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

export function validateCoachAvailabilityInput(input: {
  localStart?: unknown;
  durationMinutes?: unknown;
  refreshLocation?: unknown;
}): CoachAvailabilityInputResult {
  const errors: string[] = [];
  const localStart = normalizeSingleLine(input.localStart);
  const durationMinutes = Number(input.durationMinutes);

  if (!isValidLocalDateTime(localStart)) {
    errors.push("Choose a valid local start date and time.");
  } else if (Number(localStart.slice(-2)) % 15 !== 0) {
    errors.push("Start times must use a 15-minute boundary.");
  }
  if (!isCoachAvailabilityDuration(durationMinutes)) {
    errors.push(
      "Session duration must be between 30 and 180 minutes in 15-minute steps.",
    );
  }

  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({
      localStart,
      durationMinutes: durationMinutes as CoachAvailabilityDuration,
      refreshLocation: input.refreshLocation === true,
    }),
  });
}

export function validateCoachAvailabilityRuleInput(input: {
  isoWeekday?: unknown;
  localStartTime?: unknown;
}): CoachAvailabilityRuleInputResult {
  const errors: string[] = [];
  const isoWeekday = Number(input.isoWeekday);
  const localStartTime = normalizeSingleLine(input.localStartTime);

  if (!Number.isInteger(isoWeekday) || isoWeekday < 1 || isoWeekday > 7) {
    errors.push("Choose a weekday from Monday through Sunday.");
  }
  if (!/^(?:[01]\d|2[0-2]):00$/.test(localStartTime)) {
    errors.push(
      "Choose a whole-hour start between 00:00 and 22:00 local time.",
    );
  }

  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    valid: true,
    value: Object.freeze({
      isoWeekday: isoWeekday as CoachAvailabilityIsoWeekday,
      localStartTime,
    }),
  });
}

const MAX_COACH_AVAILABILITY_RULES = 7 * 23;
const MAX_COACH_AVAILABILITY_RULE_SET_PAYLOAD_LENGTH = 4096;

export function coachAvailabilityRuleKey(
  rule: Pick<CoachAvailabilityRuleInput, "isoWeekday" | "localStartTime">,
) {
  return `${rule.isoWeekday}|${rule.localStartTime}`;
}

export function validateCoachAvailabilityRuleSetInput(
  input: unknown,
): CoachAvailabilityRuleSetInputResult {
  if (
    typeof input !== "string" ||
    input.length > MAX_COACH_AVAILABILITY_RULE_SET_PAYLOAD_LENGTH
  ) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["The working-week selection is invalid."]),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_COACH_AVAILABILITY_RULES) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["The working-week selection is invalid."]),
    });
  }

  const rules: CoachAvailabilityRuleInput[] = [];
  const keys = new Set<string>();
  for (const entry of parsed) {
    const match =
      typeof entry === "string"
        ? /^([1-7])\|((?:[01]\d|2[0-2]):00)$/.exec(entry)
        : null;
    if (!match) {
      return Object.freeze({
        valid: false,
        errors: Object.freeze(["The working-week selection is invalid."]),
      });
    }
    const validation = validateCoachAvailabilityRuleInput({
      isoWeekday: match[1],
      localStartTime: match[2],
    });
    if (!validation.valid) return validation;
    const key = coachAvailabilityRuleKey(validation.value);
    if (keys.has(key)) {
      return Object.freeze({
        valid: false,
        errors: Object.freeze([
          "The working-week selection contains a duplicate hour.",
        ]),
      });
    }
    keys.add(key);
    rules.push(validation.value);
  }

  rules.sort(
    (left, right) =>
      left.isoWeekday - right.isoWeekday ||
      left.localStartTime.localeCompare(right.localStartTime),
  );
  const sortedKeys = rules.map(coachAvailabilityRuleKey);
  return Object.freeze({
    valid: true,
    value: Object.freeze({
      keys: Object.freeze(sortedKeys),
      rules: Object.freeze(rules),
    }),
  });
}

export function isCoachAvailabilitySlotId(value: string) {
  return isUuid(value);
}

export function isCoachAvailabilityRuleId(value: string) {
  return isUuid(value);
}

function dateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function localDateTimeValue(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return `${dateTimePart(parts, "year")}-${dateTimePart(parts, "month")}-${dateTimePart(parts, "day")}T${dateTimePart(parts, "hour")}:${dateTimePart(parts, "minute")}`;
}

export function defaultCoachSlotLocalStart(timeZone: string, now = new Date()) {
  const earliest = now.getTime() + 30 * 60 * 1000;
  const rounded = Math.ceil(earliest / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return localDateTimeValue(new Date(rounded), timeZone);
}

export function isCoachPublicSlug(value: string) {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}
