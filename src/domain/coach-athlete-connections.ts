import { isCanonicalUuid, type CoachBookingStatus } from "./coach-bookings";
import type { CoachBookingRequestStatus } from "./coach-booking-requests";

export const CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "removed",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
export type ConnectionRole = "coach" | "athlete";
export type ConnectionSection =
  "incoming" | "outgoing" | "accepted" | "history";
export type ConnectionDecision =
  "accept" | "decline" | "withdraw" | "disconnect";
export type ConnectionCursor = Readonly<{ createdAt: string; id: string }>;
export type ConnectionPage<T> = Readonly<{
  items: readonly T[];
  nextCursor: ConnectionCursor | null;
}>;
export type ConnectionPageOptions = Readonly<{
  pageSize?: number;
  cursor?: ConnectionCursor | null;
}>;
export type ConnectionProjection = Readonly<{
  id: string;
  pairId: string;
  attemptNumber: number;
  coachProfileId: string;
  athleteProfileId: string;
  senderProfileId: string;
  recipientProfileId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  removedAt: string | null;
  coachDisplayName: string;
  athleteDisplayName: string;
  coachSlug: string;
  coachPublic: boolean;
  coachPortraitUrl: string | null;
  athleteAvatarUrl: string | null;
  canAccept: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
  canDisconnect: boolean;
}>;
export type BookingConnectionContext = Readonly<{
  connection: ConnectionProjection | null;
  canSend: boolean;
}>;
export type ConnectionHistoryReference = Readonly<{
  id: string;
  requestId: string | null;
  bookingId: string | null;
  requestStatus: CoachBookingRequestStatus | null;
  bookingStatus: CoachBookingStatus | null;
  createdAt: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  coachTimezone: string;
  trainingLocationName: string;
  publicLocationLabel: string;
}>;

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return CONNECTION_STATUSES.some((status) => status === value);
}
export function isConnectionRole(value: unknown): value is ConnectionRole {
  return value === "coach" || value === "athlete";
}
export function isConnectionSection(
  value: unknown,
): value is ConnectionSection {
  return (
    value === "incoming" ||
    value === "outgoing" ||
    value === "accepted" ||
    value === "history"
  );
}
export function isConnectionDecision(
  value: unknown,
): value is ConnectionDecision {
  return (
    value === "accept" ||
    value === "decline" ||
    value === "withdraw" ||
    value === "disconnect"
  );
}
export function isConnectionCursor(value: unknown): value is ConnectionCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<ConnectionCursor>;
  return (
    typeof cursor.id === "string" &&
    isCanonicalUuid(cursor.id) &&
    typeof cursor.createdAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(cursor.createdAt) &&
    Number.isFinite(new Date(cursor.createdAt).getTime())
  );
}
export function validConnectionPageOptions(
  options: ConnectionPageOptions = {},
) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    return false;
  return (
    (options.pageSize === undefined ||
      (Number.isInteger(options.pageSize) &&
        options.pageSize >= 1 &&
        options.pageSize <= 50)) &&
    (options.cursor == null || isConnectionCursor(options.cursor))
  );
}
export function connectionAthleteAvatarUrl(id: string, version: string | null) {
  if (
    !isCanonicalUuid(id) ||
    version === null ||
    !Number.isFinite(new Date(version).getTime())
  )
    return null;
  return `/api/connections/${id}/athlete-avatar?v=${encodeURIComponent(new Date(version).toISOString())}`;
}
