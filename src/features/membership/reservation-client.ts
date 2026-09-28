"use client";

import {
  isMemberClassBookingStatus,
  type ClassReservationStatus,
  type MemberClassSchedule,
  type MemberClassSession,
} from "@/domain/class-reservations";

export type MemberClassScheduleClientResult =
  | Readonly<{ status: "ready"; schedule: MemberClassSchedule }>
  | Readonly<{
      status:
        "no-active-membership" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type MemberClassMutationClientResult = Readonly<{
  status: string;
  reservationId?: string;
}>;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function reservation(value: unknown): MemberClassSession["reservation"] | null {
  if (value === null) return null;
  const record = object(value);
  if (!record) return null;
  const status = record.status;
  if (
    !string(record.id) ||
    !["reserved", "cancelled", "checked_in", "no_show"].includes(
      String(status),
    ) ||
    !(
      record.cancellationReason === null ||
      record.cancellationReason === "member" ||
      record.cancellationReason === "session"
    ) ||
    typeof record.holdsBasicUse !== "boolean"
  ) {
    return null;
  }
  return Object.freeze({
    id: record.id,
    status: status as ClassReservationStatus,
    cancellationReason: record.cancellationReason,
    holdsBasicUse: record.holdsBasicUse,
  });
}

function session(value: unknown): MemberClassSession | null {
  const record = object(value);
  const venue = object(record?.venue);
  const trainer = object(record?.trainer);
  const bookingStatus = String(record?.bookingStatus);
  if (
    !record ||
    !string(record.id) ||
    !string(record.slug) ||
    !string(record.title) ||
    !string(record.description) ||
    !string(record.discipline) ||
    !string(record.timezone) ||
    !string(record.startsAt) ||
    !string(record.endsAt) ||
    !string(record.serviceDate) ||
    typeof record.capacity !== "number" ||
    typeof record.reservedCount !== "number" ||
    typeof record.remainingCapacity !== "number" ||
    !isMemberClassBookingStatus(bookingStatus) ||
    !venue ||
    !string(venue.id) ||
    !string(venue.slug) ||
    !string(venue.name) ||
    !trainer ||
    !string(trainer.name) ||
    !string(trainer.title)
  ) {
    return null;
  }
  const parsedReservation = reservation(record.reservation);
  if (record.reservation !== null && parsedReservation === null) return null;
  return Object.freeze({
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    discipline: record.discipline,
    timezone: record.timezone,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    serviceDate: record.serviceDate,
    capacity: record.capacity,
    reservedCount: record.reservedCount,
    remainingCapacity: record.remainingCapacity,
    bookingStatus,
    venue: Object.freeze({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
    }),
    trainer: Object.freeze({
      name: trainer.name,
      title: trainer.title,
    }),
    reservation: parsedReservation,
  });
}

export function parseMemberClassSchedule(
  value: unknown,
): MemberClassSchedule | null {
  const record = object(value);
  const plan = object(record?.plan);
  if (
    !record ||
    !string(record.membershipPeriodId) ||
    !plan ||
    (plan.id !== "basic" && plan.id !== "classic") ||
    !Number.isInteger(plan.includedCheckinsUsed) ||
    Number(plan.includedCheckinsUsed) < 0 ||
    !Number.isInteger(plan.includedCheckinsHeld) ||
    Number(plan.includedCheckinsHeld) < 0 ||
    (plan.id === "basic" &&
      (!Number.isInteger(plan.includedCheckins) ||
        Number(plan.includedCheckins) <
          Number(plan.includedCheckinsUsed) +
            Number(plan.includedCheckinsHeld))) ||
    (plan.id === "classic" &&
      (plan.includedCheckins !== null || plan.includedCheckinsHeld !== 0)) ||
    !Array.isArray(record.sessions)
  ) {
    return null;
  }
  const sessions = record.sessions.map(session);
  if (sessions.some((candidate) => candidate === null)) return null;
  const planId = plan.id as "basic" | "classic";
  const includedCheckins = plan.includedCheckins as number | null;
  const includedCheckinsUsed = plan.includedCheckinsUsed as number;
  const includedCheckinsHeld = plan.includedCheckinsHeld as number;
  return Object.freeze({
    membershipPeriodId: record.membershipPeriodId,
    plan: Object.freeze({
      id: planId,
      includedCheckins,
      includedCheckinsUsed,
      includedCheckinsHeld,
    }),
    sessions: Object.freeze(sessions as MemberClassSession[]),
  });
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

export async function fetchMemberClassSchedule(): Promise<MemberClassScheduleClientResult> {
  try {
    const value = object(await jsonRequest("/api/membership/classes"));
    if (value?.status === "ready") {
      const parsed = parseMemberClassSchedule(value.schedule);
      return parsed
        ? { status: "ready", schedule: parsed }
        : { status: "unavailable" };
    }
    if (
      value?.status === "no-active-membership" ||
      value?.status === "signed-out" ||
      value?.status === "forbidden"
    ) {
      return { status: value.status };
    }
  } catch {
    // The bounded unavailable result below keeps transport details private.
  }
  return { status: "unavailable" };
}

async function mutation(
  path: string,
  body: Record<string, unknown>,
): Promise<MemberClassMutationClientResult> {
  try {
    const value = object(
      await jsonRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    if (!value || typeof value.status !== "string") {
      return { status: "unavailable" };
    }
    return {
      status: value.status,
      ...(typeof value.reservationId === "string"
        ? { reservationId: value.reservationId }
        : {}),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function reserveMemberClassRequest(
  operationId: string,
  classSessionId: string,
) {
  return mutation("/api/membership/reservations", {
    operationId,
    classSessionId,
  });
}

export function cancelMemberClassReservationRequest(reservationId: string) {
  return mutation("/api/membership/reservations/cancel", { reservationId });
}
