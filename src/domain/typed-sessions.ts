import {
  sessionUuid,
  type SessionType,
  type SessionDuration,
  SESSION_DURATIONS,
} from "./session-types";
export type SessionTime = Readonly<{ startsAt: string; endsAt: string }>;
export type SessionCatalog = Readonly<{
  enabled: boolean;
  types: readonly SessionType[];
  locations: readonly { id: string; name: string; label: string }[];
}>;
export type TypedSessionRequest = Readonly<{
  commandId: string;
  typeId: string;
  typeRevision: number;
  locationId: string;
  startsAt: string;
}>;
export type CoachSessionCommand = TypedSessionRequest &
  Readonly<{
    action: "create" | "override";
    durationMinutes: SessionDuration;
    athleteId?: string;
    bookingId?: string;
    expectedRevision?: number;
  }>;
export type SessionBookingDetail = Readonly<{
  bookingId: string;
  revision: number;
  status: string;
  startsAt: string;
  endsAt: string;
  locationId: string;
  venueName: string;
  sessionType: SessionType | null;
  athleteId: string;
  viewerIsCoach: boolean;
  historyTotal: number;
  nextHistoryRevision: number | null;
  changes: readonly {
    revision: number;
    changedAt: string;
    previousStart: string;
    previousEnd: string;
    previousVenue: string;
    newTerms: { startsAt: string; endsAt: string; venue: string };
  }[];
}>;
export function parseTypedRequest(
  value: unknown,
  coach = false,
): TypedSessionRequest | CoachSessionCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = [
    "commandId",
    "typeId",
    "typeRevision",
    "locationId",
    "startsAt",
    ...(coach
      ? [
          "action",
          "durationMinutes",
          "athleteId",
          "bookingId",
          "expectedRevision",
        ]
      : []),
  ];
  if (
    Object.keys(v).some((k) => !keys.includes(k)) ||
    !sessionUuid(v.commandId) ||
    !sessionUuid(v.typeId) ||
    !sessionUuid(v.locationId) ||
    !Number.isSafeInteger(v.typeRevision) ||
    Number(v.typeRevision) < 0 ||
    Number(v.typeRevision) >= 2147483647 ||
    typeof v.startsAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?(?:Z|[+-]\d\d:\d\d)$/.test(
      v.startsAt,
    ) ||
    !Number.isFinite(Date.parse(v.startsAt)) ||
    Date.parse(v.startsAt) % 900000 !== 0
  )
    return null;
  if (coach) {
    if (
      !["create", "override"].includes(String(v.action)) ||
      !SESSION_DURATIONS.includes(v.durationMinutes as SessionDuration)
    )
      return null;
    if (
      v.action === "create" &&
      (!sessionUuid(v.athleteId) ||
        v.bookingId !== undefined ||
        v.expectedRevision !== undefined)
    )
      return null;
    if (
      v.action === "override" &&
      (!sessionUuid(v.bookingId) ||
        v.athleteId !== undefined ||
        !Number.isSafeInteger(v.expectedRevision) ||
        Number(v.expectedRevision) < 0 ||
        Number(v.expectedRevision) >= 2147483647)
    )
      return null;
  }
  return v as TypedSessionRequest | CoachSessionCommand;
}
