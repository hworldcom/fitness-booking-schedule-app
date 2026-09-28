export const memberClassBookingStatuses = [
  "available",
  "reserved",
  "full",
  "same-day-conflict",
  "allowance-exhausted",
  "past",
  "member-cancelled",
  "session-cancelled",
  "checked-in",
  "no-show",
] as const;

export type MemberClassBookingStatus =
  (typeof memberClassBookingStatuses)[number];

export type ClassReservationStatus =
  "reserved" | "cancelled" | "checked_in" | "no_show";

export type MemberClassSession = Readonly<{
  id: string;
  slug: string;
  title: string;
  description: string;
  discipline: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  serviceDate: string;
  capacity: number;
  reservedCount: number;
  remainingCapacity: number;
  bookingStatus: MemberClassBookingStatus;
  venue: Readonly<{
    id: string;
    slug: string;
    name: string;
  }>;
  trainer: Readonly<{
    name: string;
    title: string;
  }>;
  reservation: Readonly<{
    id: string;
    status: ClassReservationStatus;
    cancellationReason: "member" | "session" | null;
    holdsBasicUse: boolean;
  }> | null;
}>;

export type MemberClassSchedule = Readonly<{
  membershipPeriodId: string;
  plan: Readonly<{
    id: "basic" | "classic";
    includedCheckins: number | null;
    includedCheckinsUsed: number;
    includedCheckinsHeld: number;
  }>;
  sessions: readonly MemberClassSession[];
}>;

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function normalizeClassReservationId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return uuidV4Pattern.test(normalized) ? normalized : null;
}

export function isMemberClassBookingStatus(
  value: string,
): value is MemberClassBookingStatus {
  return memberClassBookingStatuses.includes(value as MemberClassBookingStatus);
}
