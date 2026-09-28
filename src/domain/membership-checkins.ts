export const membershipArrivalStatuses = [
  "pending",
  "confirmed",
  "expired",
  "cancelled",
] as const;

export type MembershipArrivalStatus =
  (typeof membershipArrivalStatuses)[number];

export type MembershipCheckinSnapshot = Readonly<{
  activePeriod: Readonly<{
    membershipPeriodId: string;
    planCode: "basic" | "classic";
    includedCheckins: number | null;
    includedCheckinsUsed: number;
    heldCheckins: number;
  }> | null;
  pendingArrival: Readonly<{
    requestId: string;
    operationId: string;
    venueId: string;
    venueSlug: string;
    venueName: string;
    reservationId: string | null;
    classSessionId: string | null;
    classTitle: string | null;
    serviceDate: string;
    status: "pending";
    createdAt: string;
    expiresAt: string;
  }> | null;
  history: readonly Readonly<{
    checkinId: string;
    membershipPeriodId: string;
    venueId: string;
    venueSlug: string;
    venueName: string;
    reservationId: string | null;
    classSessionId: string | null;
    classTitle: string | null;
    serviceDate: string;
    attendanceKind: "class" | "open_gym";
    confirmedAt: string;
  }>[];
}>;

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const presentationCodePattern = /^[A-Za-z0-9_-]{43}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const serviceDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidV4Pattern.test(value.toLowerCase());
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    value.length <= 40
  );
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableBoundedText(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length <= 160);
}

function isVenue(value: Record<string, unknown>) {
  return (
    isUuid(value.venueId) &&
    typeof value.venueSlug === "string" &&
    slugPattern.test(value.venueSlug) &&
    typeof value.venueName === "string" &&
    value.venueName.length >= 2 &&
    value.venueName.length <= 160
  );
}

function isActivePeriod(
  value: unknown,
): value is NonNullable<MembershipCheckinSnapshot["activePeriod"]> {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "membershipPeriodId",
      "planCode",
      "includedCheckins",
      "includedCheckinsUsed",
      "heldCheckins",
    ]) ||
    !isUuid(value.membershipPeriodId) ||
    (value.planCode !== "basic" && value.planCode !== "classic") ||
    !Number.isInteger(value.includedCheckinsUsed) ||
    (value.includedCheckinsUsed as number) < 0 ||
    !Number.isInteger(value.heldCheckins) ||
    (value.heldCheckins as number) < 0
  ) {
    return false;
  }
  return value.planCode === "basic"
    ? Number.isInteger(value.includedCheckins) &&
        (value.includedCheckins as number) > 0 &&
        (value.includedCheckinsUsed as number) <=
          (value.includedCheckins as number)
    : value.includedCheckins === null;
}

function isPendingArrival(
  value: unknown,
): value is NonNullable<MembershipCheckinSnapshot["pendingArrival"]> {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, [
      "requestId",
      "operationId",
      "venueId",
      "venueSlug",
      "venueName",
      "reservationId",
      "classSessionId",
      "classTitle",
      "serviceDate",
      "status",
      "createdAt",
      "expiresAt",
    ]) &&
    isUuid(value.requestId) &&
    isUuid(value.operationId) &&
    isVenue(value) &&
    isNullableUuid(value.reservationId) &&
    isNullableUuid(value.classSessionId) &&
    isNullableBoundedText(value.classTitle) &&
    typeof value.serviceDate === "string" &&
    serviceDatePattern.test(value.serviceDate) &&
    value.status === "pending" &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.expiresAt) &&
    (value.reservationId === null) === (value.classSessionId === null) &&
    (value.reservationId === null) === (value.classTitle === null)
  );
}

function isHistoryEntry(
  value: unknown,
): value is MembershipCheckinSnapshot["history"][number] {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, [
      "checkinId",
      "membershipPeriodId",
      "venueId",
      "venueSlug",
      "venueName",
      "reservationId",
      "classSessionId",
      "classTitle",
      "serviceDate",
      "attendanceKind",
      "confirmedAt",
    ]) &&
    isUuid(value.checkinId) &&
    isUuid(value.membershipPeriodId) &&
    isVenue(value) &&
    isNullableUuid(value.reservationId) &&
    isNullableUuid(value.classSessionId) &&
    isNullableBoundedText(value.classTitle) &&
    typeof value.serviceDate === "string" &&
    serviceDatePattern.test(value.serviceDate) &&
    (value.attendanceKind === "class" || value.attendanceKind === "open_gym") &&
    isTimestamp(value.confirmedAt) &&
    (value.attendanceKind === "open_gym") === (value.reservationId === null) &&
    (value.reservationId === null) === (value.classSessionId === null) &&
    (value.reservationId === null) === (value.classTitle === null)
  );
}

export function isMembershipCheckinSnapshot(
  value: unknown,
): value is MembershipCheckinSnapshot {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["activePeriod", "pendingArrival", "history"]) ||
    !(value.activePeriod === null || isActivePeriod(value.activePeriod)) ||
    !(
      value.pendingArrival === null || isPendingArrival(value.pendingArrival)
    ) ||
    !Array.isArray(value.history) ||
    !value.history.every(isHistoryEntry)
  ) {
    return false;
  }
  return (
    value.pendingArrival === null ||
    (value.activePeriod !== null && value.pendingArrival.requestId.length > 0)
  );
}

export function normalizeMembershipCheckinId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return uuidV4Pattern.test(normalized) ? normalized : null;
}

export function normalizeMembershipPresentationCode(value: unknown) {
  if (typeof value !== "string" || !presentationCodePattern.test(value)) {
    return null;
  }
  return value;
}
