import "server-only";

import { sql } from "drizzle-orm";
import {
  isMembershipCheckinSnapshot,
  membershipArrivalStatuses,
  type MembershipArrivalStatus,
  type MembershipCheckinSnapshot,
} from "@/domain/membership-checkins";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export type CreateMemberArrivalRecordResult = Readonly<{
  result:
    | "created"
    | "existing"
    | "invalid-request"
    | "no-active-membership"
    | "venue-unavailable"
    | "reservation-unavailable"
    | "too-early"
    | "too-late"
    | "daily-conflict"
    | "allowance-exhausted"
    | "pending-conflict"
    | "operation-conflict";
  requestId: string | null;
  requestStatus: MembershipArrivalStatus | null;
  expiresAt: string | null;
}>;

export type CancelMemberArrivalRecordResult =
  | "cancelled"
  | "existing"
  | "expired"
  | "confirmed"
  | "invalid-request"
  | "not-found";

export type ConfirmMemberArrivalRecordResult = Readonly<{
  result:
    | "confirmed"
    | "existing"
    | "invalid-request"
    | "not-found"
    | "forbidden"
    | "cancelled"
    | "expired"
    | "membership-inactive"
    | "claim-unavailable"
    | "allowance-exhausted"
    | "too-early"
    | "reservation-unavailable";
  checkinId: string | null;
}>;

export class MembershipCheckinRecordError extends Error {
  constructor() {
    super("Membership check-in persistence returned inconsistent state.");
    this.name = "MembershipCheckinRecordError";
  }
}

const arrivalStatusSet = new Set<MembershipArrivalStatus>(
  membershipArrivalStatuses,
);
const createResults = new Set<CreateMemberArrivalRecordResult["result"]>([
  "created",
  "existing",
  "invalid-request",
  "no-active-membership",
  "venue-unavailable",
  "reservation-unavailable",
  "too-early",
  "too-late",
  "daily-conflict",
  "allowance-exhausted",
  "pending-conflict",
  "operation-conflict",
]);
const cancelResults = new Set<CancelMemberArrivalRecordResult>([
  "cancelled",
  "existing",
  "expired",
  "confirmed",
  "invalid-request",
  "not-found",
]);
const confirmationResults = new Set<ConfirmMemberArrivalRecordResult["result"]>(
  [
    "confirmed",
    "existing",
    "invalid-request",
    "not-found",
    "forbidden",
    "cancelled",
    "expired",
    "membership-inactive",
    "claim-unavailable",
    "allowance-exhausted",
    "too-early",
    "reservation-unavailable",
  ],
);

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

export async function currentMemberCheckinSnapshotRecord(
  transaction: ActorDatabaseTransaction,
): Promise<MembershipCheckinSnapshot> {
  const rows = await transaction.execute<{ snapshot: unknown }>(sql`
    select app.current_member_checkin_snapshot() as snapshot
  `);
  const snapshot = rows[0]?.snapshot;
  if (rows.length !== 1 || !isMembershipCheckinSnapshot(snapshot)) {
    throw new MembershipCheckinRecordError();
  }
  return Object.freeze(snapshot);
}

export async function createMemberArrivalRequestRecord(
  transaction: ActorDatabaseTransaction,
  input: {
    operationId: string;
    venueId: string;
    reservationId: string | null;
    codeHashHex: string;
  },
): Promise<CreateMemberArrivalRecordResult> {
  const rows = await transaction.execute<{
    arrival_result: string;
    arrival_request_id: string | null;
    arrival_status: string | null;
    arrival_expires_at: string | Date | null;
  }>(sql`
    select *
    from app.create_member_arrival_request(
      ${input.operationId}::uuid,
      ${input.venueId}::uuid,
      ${input.reservationId}::uuid,
      ${input.codeHashHex}::text
    )
  `);
  const row = rows[0];
  const requestStatus = row?.arrival_status;
  const hasRequest = Boolean(row?.arrival_request_id);
  if (
    rows.length !== 1 ||
    !row ||
    !createResults.has(
      row.arrival_result as CreateMemberArrivalRecordResult["result"],
    ) ||
    !(
      requestStatus === null ||
      arrivalStatusSet.has(requestStatus as MembershipArrivalStatus)
    ) ||
    hasRequest !== Boolean(requestStatus) ||
    hasRequest !== Boolean(row.arrival_expires_at) ||
    ["created", "existing", "pending-conflict"].includes(row.arrival_result) !==
      hasRequest
  ) {
    throw new MembershipCheckinRecordError();
  }
  return Object.freeze({
    result: row.arrival_result as CreateMemberArrivalRecordResult["result"],
    requestId: row.arrival_request_id,
    requestStatus: requestStatus as MembershipArrivalStatus | null,
    expiresAt: iso(row.arrival_expires_at),
  });
}

export async function cancelMemberArrivalRequestRecord(
  transaction: ActorDatabaseTransaction,
  requestId: string,
) {
  const rows = await transaction.execute<{ result: string }>(sql`
    select app.cancel_member_arrival_request(${requestId}::uuid) as result
  `);
  const result = rows[0]?.result;
  if (
    !result ||
    !cancelResults.has(result as CancelMemberArrivalRecordResult)
  ) {
    throw new MembershipCheckinRecordError();
  }
  return result as CancelMemberArrivalRecordResult;
}

export async function confirmMemberArrivalRecord(
  transaction: ActorDatabaseTransaction,
  codeHashHex: string,
): Promise<ConfirmMemberArrivalRecordResult> {
  const rows = await transaction.execute<{
    confirmation_result: string;
    checkin_id: string | null;
  }>(sql`
    select * from app.confirm_member_arrival(${codeHashHex}::text)
  `);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    !confirmationResults.has(
      row.confirmation_result as ConfirmMemberArrivalRecordResult["result"],
    ) ||
    ["confirmed", "existing"].includes(row.confirmation_result) !==
      Boolean(row.checkin_id)
  ) {
    throw new MembershipCheckinRecordError();
  }
  return Object.freeze({
    result:
      row.confirmation_result as ConfirmMemberArrivalRecordResult["result"],
    checkinId: row.checkin_id,
  });
}
