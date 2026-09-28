import "server-only";

import {
  normalizeClassReservationId,
  type MemberClassSchedule,
  type MemberClassSession,
} from "@/domain/class-reservations";
import type { MembershipPeriodSnapshot } from "@/domain/membership-activation";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  cancelMemberClassReservationRecord,
  currentMemberClassScheduleRecords,
  reserveMemberClassRecord,
  type MemberClassScheduleRecord,
} from "@/server/db/reservations/repository";
import { memberMembershipState } from "@/server/membership/service";

export type MemberClassScheduleResult =
  | Readonly<{ status: "ready"; schedule: MemberClassSchedule }>
  | Readonly<{
      status:
        | "preview"
        | "signed-out"
        | "forbidden"
        | "unavailable"
        | "no-active-membership";
    }>;

export type MemberClassReservationMutationResult = Readonly<{
  status: string;
  reservationId?: string;
}>;

function accessStatus(status: string): MemberClassScheduleResult {
  if (
    status === "preview" ||
    status === "signed-out" ||
    status === "forbidden"
  ) {
    return Object.freeze({ status });
  }
  return Object.freeze({ status: "unavailable" });
}

function memberClassSession(
  record: MemberClassScheduleRecord,
): MemberClassSession {
  return Object.freeze({
    id: record.classSessionId,
    slug: record.classSessionSlug,
    title: record.classTitle,
    description: record.classDescription,
    discipline: record.discipline,
    timezone: record.timezone,
    startsAt: new Date(record.startsAt).toISOString(),
    endsAt: new Date(record.endsAt).toISOString(),
    serviceDate: record.serviceDate,
    capacity: record.capacity,
    reservedCount: record.reservedCount,
    remainingCapacity: record.remainingCapacity,
    bookingStatus: record.bookingStatus,
    venue: Object.freeze({
      id: record.venueId,
      slug: record.venueSlug,
      name: record.venueName,
    }),
    trainer: Object.freeze({
      name: record.trainerName,
      title: record.trainerTitle,
    }),
    reservation: record.reservationId
      ? Object.freeze({
          id: record.reservationId,
          status: record.reservationStatus!,
          cancellationReason: record.cancellationReason,
          holdsBasicUse: record.holdsBasicUse,
        })
      : null,
  });
}

export function memberClassScheduleFromRecords(
  period: MembershipPeriodSnapshot,
  records: readonly MemberClassScheduleRecord[],
): MemberClassSchedule {
  return Object.freeze({
    membershipPeriodId: period.id,
    plan: Object.freeze({
      id: period.plan.id,
      includedCheckins:
        period.plan.access.model === "limited"
          ? period.plan.access.includedCheckins
          : null,
      includedCheckinsUsed: period.includedCheckinsUsed,
      includedCheckinsHeld: records.filter(
        (record) =>
          record.reservationStatus === "reserved" && record.holdsBasicUse,
      ).length,
    }),
    sessions: Object.freeze(records.map(memberClassSession)),
  });
}

export async function memberClassSchedule(): Promise<MemberClassScheduleResult> {
  const membership = await memberMembershipState();
  if (membership.status !== "ready") return accessStatus(membership.status);
  const activePeriod = membership.membership.activePeriod;
  if (!activePeriod) {
    return Object.freeze({ status: "no-active-membership" });
  }

  const result = await withAuthorizedActor(currentMemberClassScheduleRecords);
  if (result.status !== "authorized") return accessStatus(result.status);
  return Object.freeze({
    status: "ready",
    schedule: memberClassScheduleFromRecords(activePeriod, result.value),
  });
}

export async function reserveMemberClass(input: {
  operationId: unknown;
  classSessionId: unknown;
}): Promise<MemberClassReservationMutationResult> {
  const operationId = normalizeClassReservationId(input.operationId);
  const classSessionId = normalizeClassReservationId(input.classSessionId);
  if (!operationId || !classSessionId) {
    return Object.freeze({ status: "invalid-request" });
  }
  const result = await withAuthorizedActor((transaction) =>
    reserveMemberClassRecord(transaction, { operationId, classSessionId }),
  );
  if (result.status !== "authorized") {
    return Object.freeze({
      status:
        result.status === "preview" ||
        result.status === "signed-out" ||
        result.status === "forbidden"
          ? result.status
          : "unavailable",
    });
  }
  return result.value.reservationId
    ? Object.freeze({
        status: result.value.result,
        reservationId: result.value.reservationId,
      })
    : Object.freeze({ status: result.value.result });
}

export async function cancelMemberClassReservation(input: {
  reservationId: unknown;
}): Promise<MemberClassReservationMutationResult> {
  const reservationId = normalizeClassReservationId(input.reservationId);
  if (!reservationId) return Object.freeze({ status: "invalid-request" });
  const result = await withAuthorizedActor((transaction) =>
    cancelMemberClassReservationRecord(transaction, reservationId),
  );
  if (result.status !== "authorized") {
    return Object.freeze({
      status:
        result.status === "preview" ||
        result.status === "signed-out" ||
        result.status === "forbidden"
          ? result.status
          : "unavailable",
    });
  }
  return Object.freeze({ status: result.value, reservationId });
}
