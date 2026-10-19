import "server-only";
import { profileImageStorage } from "@/server/storage/profile-images";
import { sql } from "drizzle-orm";
import { isCoachBookingStatus, isCanonicalUuid } from "@/domain/coach-bookings";
import { isCoachBookingRequestStatus } from "@/domain/coach-booking-requests";
import {
  connectionAthleteAvatarUrl,
  isConnectionStatus,
  validConnectionPageOptions,
  type BookingConnectionContext,
  type ConnectionDecision,
  type ConnectionHistoryReference,
  type ConnectionPage,
  type ConnectionPageOptions,
  type ConnectionProjection,
  type ConnectionRole,
  type ConnectionSection,
} from "@/domain/coach-athlete-connections";
import {
  isOwnedProfileImageStoragePath,
  isPublicCoachPortraitUrl,
  type CoachPortraitReference,
} from "@/profile-images/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export class ConnectionConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("The connection conflicts with current state.", options);
    this.name = "ConnectionConflictError";
  }
}
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConnectionConflictError();
  return value as Row;
}
function text(value: unknown, max = 240): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max)
    throw new ConnectionConflictError();
  return value;
}
function uuid(value: unknown) {
  const id = text(value, 36);
  if (!isCanonicalUuid(id)) throw new ConnectionConflictError();
  return id;
}
function nullableUuid(value: unknown) {
  return value === null ? null : uuid(value);
}
function timestamp(value: unknown): string {
  const date = new Date(text(value));
  if (!Number.isFinite(date.getTime())) throw new ConnectionConflictError();
  return date.toISOString();
}
function cursorTimestamp(value: unknown) {
  const original = text(value);
  timestamp(original);
  // SQL tuple cursors require all six PostgreSQL fractional digits. Date's
  // millisecond representation must not replace this authoritative value.
  return original;
}
function nullableTimestamp(value: unknown) {
  return value === null ? null : timestamp(value);
}
function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new ConnectionConflictError();
  return value;
}
function mapConnection(value: unknown): ConnectionProjection {
  const r = row(value);
  if (
    !isConnectionStatus(r.status) ||
    !Number.isInteger(r.attemptNumber) ||
    Number(r.attemptNumber) < 1
  )
    throw new ConnectionConflictError();
  const coachProfileId = uuid(r.coachProfileId),
    athleteProfileId = uuid(r.athleteProfileId);
  const senderProfileId = uuid(r.senderProfileId),
    recipientProfileId = uuid(r.recipientProfileId);
  if (
    coachProfileId === athleteProfileId ||
    senderProfileId === recipientProfileId ||
    ![coachProfileId, athleteProfileId].includes(senderProfileId) ||
    ![coachProfileId, athleteProfileId].includes(recipientProfileId)
  )
    throw new ConnectionConflictError();
  const decidedAt = nullableTimestamp(r.decidedAt),
    removedAt = nullableTimestamp(r.removedAt);
  if (
    (r.status === "pending") !== (decidedAt === null) ||
    (r.status === "removed") !== (removedAt !== null)
  )
    throw new ConnectionConflictError();
  let coachPortraitUrl: string | null = null;
  if (r.coachPortrait !== null) {
    const portrait = row(r.coachPortrait);
    if (portrait.source !== null) {
      if (
        portrait.source !== "fixture" &&
        portrait.source !== "storage" &&
        portrait.source !== "account"
      )
        throw new ConnectionConflictError();
      const reference: CoachPortraitReference = {
        source: portrait.source,
        path: text(portrait.path, 512),
        updatedAt: timestamp(portrait.updatedAt),
      };
      if (
        (reference.source === "account" && reference.path !== coachProfileId) ||
        (reference.source === "storage" &&
          !isOwnedProfileImageStoragePath(reference.path, coachProfileId))
      )
        throw new ConnectionConflictError();
      coachPortraitUrl = profileImageStorage.publicPortraitUrl(reference);
      if (coachPortraitUrl && !isPublicCoachPortraitUrl(coachPortraitUrl))
        throw new ConnectionConflictError();
    }
  }
  return Object.freeze({
    id: uuid(r.id),
    pairId: uuid(r.pairId),
    attemptNumber: Number(r.attemptNumber),
    coachProfileId,
    athleteProfileId,
    senderProfileId,
    recipientProfileId,
    status: r.status,
    createdAt: cursorTimestamp(r.createdAt),
    updatedAt: timestamp(r.updatedAt),
    decidedAt,
    removedAt,
    coachDisplayName: text(r.coachDisplayName, 80),
    athleteDisplayName: text(r.athleteDisplayName, 80),
    coachSlug: text(r.coachSlug, 100),
    coachPublic: boolean(r.coachPublic),
    coachPortraitUrl,
    athleteAvatarUrl: connectionAthleteAvatarUrl(
      uuid(r.id),
      nullableTimestamp(r.athleteAvatarUpdatedAt),
    ),
    canAccept: boolean(r.canAccept),
    canDecline: boolean(r.canDecline),
    canWithdraw: boolean(r.canWithdraw),
    canDisconnect: boolean(r.canDisconnect),
  });
}
function mapHistory(value: unknown): ConnectionHistoryReference {
  const r = row(value),
    requestId = nullableUuid(r.requestId),
    bookingId = nullableUuid(r.bookingId);
  if (
    (!requestId && !bookingId) ||
    (requestId === null) !== (r.requestStatus === null) ||
    (bookingId === null) !== (r.bookingStatus === null) ||
    (r.requestStatus !== null &&
      !isCoachBookingRequestStatus(text(r.requestStatus))) ||
    (r.bookingStatus !== null && !isCoachBookingStatus(text(r.bookingStatus)))
  )
    throw new ConnectionConflictError();
  const id = uuid(r.id);
  if (id !== (requestId ?? bookingId)) throw new ConnectionConflictError();
  const scheduledStartAt = timestamp(r.scheduledStartAt),
    scheduledEndAt = timestamp(r.scheduledEndAt);
  if (
    new Date(scheduledEndAt).getTime() -
      new Date(scheduledStartAt).getTime() !==
    3600000
  )
    throw new ConnectionConflictError();
  return Object.freeze({
    id,
    requestId,
    bookingId,
    requestStatus:
      r.requestStatus as ConnectionHistoryReference["requestStatus"],
    bookingStatus:
      r.bookingStatus as ConnectionHistoryReference["bookingStatus"],
    createdAt: cursorTimestamp(r.createdAt),
    scheduledStartAt,
    scheduledEndAt,
    coachTimezone: text(r.coachTimezone, 80),
    trainingLocationName: text(r.trainingLocationName),
    publicLocationLabel: text(r.publicLocationLabel),
  });
}
async function connectionQuery<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    let cause: unknown = error;
    while (cause && typeof cause === "object") {
      if (
        "code" in cause &&
        (["40001", "23505", "23503", "23514"].includes(String(cause.code)) ||
          (cause.code === "P0001" &&
            "message" in cause &&
            String(cause.message).startsWith("connection ")))
      ) {
        throw new ConnectionConflictError({ cause: error });
      }
      cause = "cause" in cause ? cause.cause : null;
    }
    throw error;
  }
}
function page<T extends { id: string; createdAt: string }>(
  rows: readonly T[],
  options: ConnectionPageOptions,
): ConnectionPage<T> {
  const size = options.pageSize ?? 20,
    items = Object.freeze(rows.slice(0, size));
  const last = items.at(-1);
  return Object.freeze({
    items,
    nextCursor:
      rows.length > size && last
        ? Object.freeze({ id: last.id, createdAt: last.createdAt })
        : null,
  });
}
export async function sendConnectionRecord(
  tx: ActorDatabaseTransaction,
  bookingId: string,
  operationId: string,
  previousId: string | null,
) {
  uuid(bookingId);
  uuid(operationId);
  nullableUuid(previousId);
  return connectionQuery(async () => {
    const rows = await tx.execute<{ projection: unknown }>(
      sql`select app.send_coach_athlete_connection(${bookingId}::uuid, ${operationId}::uuid, ${previousId}::uuid) as projection`,
    );
    return mapConnection(rows[0]?.projection);
  });
}
export async function decideConnectionRecord(
  tx: ActorDatabaseTransaction,
  id: string,
  decision: ConnectionDecision,
) {
  uuid(id);
  return connectionQuery(async () => {
    const rows = await tx.execute<{ projection: unknown }>(
      sql`select app.decide_coach_athlete_connection(${id}::uuid, ${decision}::text) as projection`,
    );
    return mapConnection(rows[0]?.projection);
  });
}
export async function bookingConnectionContextRecord(
  tx: ActorDatabaseTransaction,
  bookingId: string,
): Promise<BookingConnectionContext> {
  uuid(bookingId);
  return connectionQuery(async () => {
    const rows = await tx.execute<{ projection: unknown }>(
      sql`select app.current_booking_connection_context(${bookingId}::uuid) as projection`,
    );
    return parseBookingConnectionContext(rows[0]?.projection);
  });
}
export function parseBookingConnectionContext(
  value: unknown,
): BookingConnectionContext {
  const r = row(value);
  return Object.freeze({
    canSend: boolean(r.canSend),
    connection: r.connection === null ? null : mapConnection(r.connection),
  });
}
export async function connectionPageRecord(
  tx: ActorDatabaseTransaction,
  role: ConnectionRole,
  section: ConnectionSection,
  options: ConnectionPageOptions = {},
) {
  if (!validConnectionPageOptions(options)) throw new ConnectionConflictError();
  return connectionQuery(async () => {
    const rows = await tx.execute<{ projection: unknown }>(
      sql`select * from app.current_coach_athlete_connections(${role}::text, ${section}::text, ${(options.pageSize ?? 20) + 1}::integer, ${options.cursor?.createdAt ?? null}::timestamptz, ${options.cursor?.id ?? null}::uuid)`,
    );
    return page(
      rows.map((r) => mapConnection(r.projection)),
      options,
    );
  });
}
export async function connectionHistoryRecord(
  tx: ActorDatabaseTransaction,
  pairId: string,
  options: ConnectionPageOptions = {},
) {
  uuid(pairId);
  if (!validConnectionPageOptions(options)) throw new ConnectionConflictError();
  return connectionQuery(async () => {
    const rows = await tx.execute<{ projection: unknown }>(
      sql`select * from app.current_connection_shared_history(${pairId}::uuid, ${(options.pageSize ?? 20) + 1}::integer, ${options.cursor?.createdAt ?? null}::timestamptz, ${options.cursor?.id ?? null}::uuid)`,
    );
    return page(
      rows.map((r) => mapHistory(r.projection)),
      options,
    );
  });
}
export async function connectionAvatarReference(
  tx: ActorDatabaseTransaction,
  id: string,
) {
  uuid(id);
  const rows = await tx.execute<{
    athlete_profile_id: string;
    avatar_storage_path: string;
    avatar_updated_at: string | Date;
  }>(
    sql`select * from app.current_connection_athlete_avatar_reference(${id}::uuid)`,
  );
  const r = rows[0];
  if (!r) return null;
  if (
    !isOwnedProfileImageStoragePath(r.avatar_storage_path, r.athlete_profile_id)
  )
    throw new ConnectionConflictError();
  return Object.freeze({
    path: r.avatar_storage_path,
    updatedAt: new Date(r.avatar_updated_at).toISOString(),
  });
}
