"use client";

import type { MemberClassSession } from "@/domain/class-reservations";
import {
  isMembershipCheckinSnapshot,
  membershipArrivalStatuses,
  normalizeMembershipCheckinId,
  normalizeMembershipPresentationCode,
  type MembershipArrivalStatus,
  type MembershipCheckinSnapshot,
} from "@/domain/membership-checkins";

export const ARRIVAL_PRESENTATION_STORAGE_KEY =
  "movx-club:membership-arrival:v1";

export type StoredArrivalPresentation = Readonly<{
  version: 1;
  requestId: string;
  operationId: string;
  presentationCode: string;
  expiresAt: string;
}>;

export type MemberCheckinSnapshotClientResult =
  | Readonly<{ status: "ready"; snapshot: MembershipCheckinSnapshot }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type MemberArrivalClientResult = Readonly<{
  status: string;
  requestId?: string;
  requestStatus?: MembershipArrivalStatus;
  expiresAt?: string;
  presentationCode?: string;
}>;

type ArrivalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const createFailureStatuses = new Set([
  "invalid-request",
  "no-active-membership",
  "venue-unavailable",
  "reservation-unavailable",
  "too-early",
  "too-late",
  "daily-conflict",
  "allowance-exhausted",
  "operation-conflict",
  "signed-out",
  "forbidden",
  "preview",
  "unavailable",
]);
const cancelStatuses = new Set([
  "cancelled",
  "existing",
  "expired",
  "confirmed",
  "invalid-request",
  "not-found",
  "signed-out",
  "forbidden",
  "preview",
  "unavailable",
]);
const cancelStatusesWithoutRequestId = new Set([
  "invalid-request",
  "signed-out",
  "forbidden",
  "preview",
  "unavailable",
]);

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    Number.isFinite(Date.parse(value))
  );
}

function arrivalStatus(value: unknown): value is MembershipArrivalStatus {
  return membershipArrivalStatuses.includes(value as MembershipArrivalStatus);
}

function browserSessionStorage(): ArrivalStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function jsonRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    ...init,
  });
  return response.json();
}

export function parseMemberCheckinSnapshotResponse(
  value: unknown,
): MemberCheckinSnapshotClientResult {
  const record = object(value);
  if (
    record?.status === "ready" &&
    hasExactKeys(record, ["status", "snapshot"]) &&
    isMembershipCheckinSnapshot(record.snapshot)
  ) {
    return { status: "ready", snapshot: record.snapshot };
  }
  if (
    record &&
    hasExactKeys(record, ["status"]) &&
    (record.status === "preview" ||
      record.status === "signed-out" ||
      record.status === "forbidden")
  ) {
    return { status: record.status };
  }
  return { status: "unavailable" };
}

export function parseMemberArrivalResponse(
  value: unknown,
): MemberArrivalClientResult {
  const record = object(value);
  if (!record || typeof record.status !== "string") {
    return { status: "unavailable" };
  }
  if (record.status === "created") {
    const requestId = normalizeMembershipCheckinId(record.requestId);
    const presentationCode = normalizeMembershipPresentationCode(
      record.presentationCode,
    );
    if (
      !hasExactKeys(record, [
        "status",
        "requestId",
        "requestStatus",
        "expiresAt",
        "presentationCode",
      ]) ||
      !requestId ||
      record.requestStatus !== "pending" ||
      !timestamp(record.expiresAt) ||
      !presentationCode
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "created",
      requestId,
      requestStatus: "pending",
      expiresAt: record.expiresAt,
      presentationCode,
    };
  }
  if (record.status === "existing" || record.status === "pending-conflict") {
    const requestId = normalizeMembershipCheckinId(record.requestId);
    if (
      !hasExactKeys(record, [
        "status",
        "requestId",
        "requestStatus",
        "expiresAt",
      ]) ||
      !requestId ||
      !arrivalStatus(record.requestStatus) ||
      !timestamp(record.expiresAt) ||
      (record.status === "pending-conflict" &&
        record.requestStatus !== "pending")
    ) {
      return { status: "unavailable" };
    }
    return {
      status: record.status,
      requestId,
      requestStatus: record.requestStatus,
      expiresAt: record.expiresAt,
    };
  }
  return hasExactKeys(record, ["status"]) &&
    createFailureStatuses.has(record.status)
    ? { status: record.status }
    : { status: "unavailable" };
}

export function parseMemberArrivalCancellationResponse(
  value: unknown,
): MemberArrivalClientResult {
  const record = object(value);
  if (
    !record ||
    typeof record.status !== "string" ||
    !cancelStatuses.has(record.status)
  ) {
    return { status: "unavailable" };
  }
  if (cancelStatusesWithoutRequestId.has(record.status)) {
    return hasExactKeys(record, ["status"])
      ? { status: record.status }
      : { status: "unavailable" };
  }
  const requestId = normalizeMembershipCheckinId(record.requestId);
  return hasExactKeys(record, ["status", "requestId"]) && requestId
    ? { status: record.status, requestId }
    : { status: "unavailable" };
}

export async function fetchMemberCheckinSnapshot(): Promise<MemberCheckinSnapshotClientResult> {
  try {
    return parseMemberCheckinSnapshotResponse(
      await jsonRequest("/api/membership/check-ins"),
    );
  } catch {
    return { status: "unavailable" };
  }
}

export async function createMemberArrivalRequest(input: {
  operationId: string;
  venueId: string;
  reservationId: string | null;
}): Promise<MemberArrivalClientResult> {
  try {
    return parseMemberArrivalResponse(
      await jsonRequest("/api/membership/check-ins", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  } catch {
    return { status: "unavailable" };
  }
}

export async function cancelMemberArrivalRequest(
  requestId: string,
): Promise<MemberArrivalClientResult> {
  try {
    return parseMemberArrivalCancellationResponse(
      await jsonRequest("/api/membership/check-ins/cancel", {
        method: "POST",
        body: JSON.stringify({ requestId }),
      }),
    );
  } catch {
    return { status: "unavailable" };
  }
}

export function readStoredArrivalPresentation(
  storage: ArrivalStorage | null = browserSessionStorage(),
):
  | Readonly<{ status: "ready"; value: StoredArrivalPresentation | null }>
  | Readonly<{ status: "unavailable" }> {
  if (!storage) return { status: "unavailable" };
  try {
    const raw = storage.getItem(ARRIVAL_PRESENTATION_STORAGE_KEY);
    if (raw === null) return { status: "ready", value: null };
    const record = object(JSON.parse(raw));
    const requestId = normalizeMembershipCheckinId(record?.requestId);
    const operationId = normalizeMembershipCheckinId(record?.operationId);
    const presentationCode = normalizeMembershipPresentationCode(
      record?.presentationCode,
    );
    if (
      !record ||
      !hasExactKeys(record, [
        "version",
        "requestId",
        "operationId",
        "presentationCode",
        "expiresAt",
      ]) ||
      record.version !== 1 ||
      !requestId ||
      !operationId ||
      !presentationCode ||
      !timestamp(record.expiresAt)
    ) {
      storage.removeItem(ARRIVAL_PRESENTATION_STORAGE_KEY);
      return { status: "ready", value: null };
    }
    return {
      status: "ready",
      value: Object.freeze({
        version: 1,
        requestId,
        operationId,
        presentationCode,
        expiresAt: record.expiresAt,
      }),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function storeArrivalPresentation(
  value: StoredArrivalPresentation,
  storage: ArrivalStorage | null = browserSessionStorage(),
) {
  if (!storage) return false;
  try {
    storage.setItem(ARRIVAL_PRESENTATION_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredArrivalPresentation(
  expectedRequestId?: string,
  storage: ArrivalStorage | null = browserSessionStorage(),
) {
  if (!storage) return false;
  try {
    if (expectedRequestId) {
      const current = readStoredArrivalPresentation(storage);
      if (
        current.status === "ready" &&
        current.value &&
        current.value.requestId !== expectedRequestId
      ) {
        return true;
      }
    }
    storage.removeItem(ARRIVAL_PRESENTATION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function reservationArrivalWindow(
  session: MemberClassSession,
  now: number,
): "open" | "too-early" | "closed" | "unavailable" {
  if (
    session.bookingStatus !== "reserved" ||
    session.reservation?.status !== "reserved"
  ) {
    return "unavailable";
  }
  const startsAt = Date.parse(session.startsAt);
  const endsAt = Date.parse(session.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return "unavailable";
  }
  if (now < startsAt - 30 * 60 * 1_000) return "too-early";
  return now < endsAt ? "open" : "closed";
}

export function terminalArrivalStatus(
  previous: NonNullable<MembershipCheckinSnapshot["pendingArrival"]>,
  next: MembershipCheckinSnapshot,
  now: number,
): "confirmed" | "expired" | null {
  if (next.pendingArrival) return null;
  const confirmed = next.history.some((entry) => {
    if (previous.reservationId) {
      return entry.reservationId === previous.reservationId;
    }
    return (
      entry.attendanceKind === "open_gym" &&
      entry.venueId === previous.venueId &&
      entry.serviceDate === previous.serviceDate &&
      Date.parse(entry.confirmedAt) >= Date.parse(previous.createdAt)
    );
  });
  if (confirmed) return "confirmed";
  return now >= Date.parse(previous.expiresAt) ? "expired" : null;
}

export function arrivalCountdown(expiresAt: string, now: number) {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - now) / 1_000),
  );
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
