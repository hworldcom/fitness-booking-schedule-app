import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  normalizeMembershipCheckinId,
  normalizeMembershipPresentationCode,
  type MembershipArrivalStatus,
  type MembershipCheckinSnapshot,
} from "@/domain/membership-checkins";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  cancelMemberArrivalRequestRecord,
  confirmMemberArrivalRecord,
  createMemberArrivalRequestRecord,
  currentMemberCheckinSnapshotRecord,
} from "@/server/db/checkins/repository";

export type MemberCheckinSnapshotResult =
  | Readonly<{ status: "ready"; snapshot: MembershipCheckinSnapshot }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type MemberArrivalMutationResult = Readonly<{
  status: string;
  requestId?: string;
  requestStatus?: MembershipArrivalStatus;
  expiresAt?: string;
  presentationCode?: string;
}>;

export type StaffConfirmationResult = Readonly<{
  status: string;
  checkinId?: string;
}>;

function accessStatus(status: string) {
  return status === "preview" ||
    status === "signed-out" ||
    status === "forbidden"
    ? status
    : "unavailable";
}

function hashCode(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function memberCheckinSnapshot(): Promise<MemberCheckinSnapshotResult> {
  const result = await withAuthorizedActor(currentMemberCheckinSnapshotRecord);
  if (result.status !== "authorized") {
    return Object.freeze({ status: accessStatus(result.status) });
  }
  return Object.freeze({ status: "ready", snapshot: result.value });
}

export async function createMemberArrival(input: {
  operationId: unknown;
  venueId: unknown;
  reservationId: unknown;
}): Promise<MemberArrivalMutationResult> {
  const operationId = normalizeMembershipCheckinId(input.operationId);
  const venueId = normalizeMembershipCheckinId(input.venueId);
  const reservationId =
    input.reservationId === null
      ? null
      : normalizeMembershipCheckinId(input.reservationId);
  if (!operationId || !venueId || input.reservationId !== reservationId) {
    return Object.freeze({ status: "invalid-request" });
  }

  const presentationCode = randomBytes(32).toString("base64url");
  const result = await withAuthorizedActor((transaction) =>
    createMemberArrivalRequestRecord(transaction, {
      operationId,
      venueId,
      reservationId,
      codeHashHex: hashCode(presentationCode),
    }),
  );
  if (result.status !== "authorized") {
    return Object.freeze({ status: accessStatus(result.status) });
  }
  const record = result.value;
  if (!record.requestId || !record.requestStatus || !record.expiresAt) {
    return Object.freeze({ status: record.result });
  }
  return Object.freeze({
    status: record.result,
    requestId: record.requestId,
    requestStatus: record.requestStatus,
    expiresAt: record.expiresAt,
    ...(record.result === "created" ? { presentationCode } : {}),
  });
}

export async function cancelMemberArrival(input: {
  requestId: unknown;
}): Promise<MemberArrivalMutationResult> {
  const requestId = normalizeMembershipCheckinId(input.requestId);
  if (!requestId) return Object.freeze({ status: "invalid-request" });
  const result = await withAuthorizedActor((transaction) =>
    cancelMemberArrivalRequestRecord(transaction, requestId),
  );
  if (result.status !== "authorized") {
    return Object.freeze({ status: accessStatus(result.status) });
  }
  return Object.freeze({ status: result.value, requestId });
}

export async function confirmMemberArrival(input: {
  presentationCode: unknown;
}): Promise<StaffConfirmationResult> {
  const presentationCode = normalizeMembershipPresentationCode(
    input.presentationCode,
  );
  if (!presentationCode) {
    return Object.freeze({ status: "invalid-request" });
  }
  const result = await withAuthorizedActor((transaction) =>
    confirmMemberArrivalRecord(transaction, hashCode(presentationCode)),
  );
  if (result.status !== "authorized") {
    return Object.freeze({ status: accessStatus(result.status) });
  }
  return result.value.checkinId
    ? Object.freeze({
        status: result.value.result,
        checkinId: result.value.checkinId,
      })
    : Object.freeze({ status: result.value.result });
}
