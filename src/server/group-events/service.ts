import "server-only";

import type {
  GroupEventDraftInput,
  VerifiedGroupEventContributionProjection,
  VerifiedGroupEventPoolProjection,
} from "@/domain/group-events";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  GroupEventConflictError,
  bindOwnedGroupEventPoolRecord,
  createOwnedGroupEventDraftRecord,
  currentOwnedGroupEventRecords,
  markGroupEventProjectionAvailabilityRecord,
  publicGroupEventCatalogueRecords,
  publicGroupEventDetailRecord,
  publishOwnedGroupEventRecord,
  recordVerifiedGroupEventContributionProjectionRecord,
  recordVerifiedGroupEventPoolProjectionRecord,
  updateOwnedGroupEventDraftRecord,
  withdrawOwnedGroupEventDraftRecord,
} from "@/server/db/group-events/repository";

type GroupEventMutationResult<T> =
  | Readonly<{ status: "authorized"; outcome: "saved"; value: T }>
  | Readonly<{ status: "authorized"; outcome: "conflict" }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

async function mutateOwnedGroupEvent<T>(
  work: Parameters<typeof withAuthorizedActor<T>>[0],
): Promise<GroupEventMutationResult<T>> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        value: await work(transaction, actor),
      });
    } catch (error) {
      if (error instanceof GroupEventConflictError)
        return Object.freeze({ outcome: "conflict" as const });
      throw error;
    }
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export function createOwnedGroupEventDraft(input: GroupEventDraftInput) {
  return mutateOwnedGroupEvent((transaction) =>
    createOwnedGroupEventDraftRecord(transaction, input),
  );
}

export function updateOwnedGroupEventDraft(
  eventId: string,
  input: GroupEventDraftInput,
) {
  return mutateOwnedGroupEvent((transaction) =>
    updateOwnedGroupEventDraftRecord(transaction, eventId, input),
  );
}

export function bindOwnedGroupEventPool(
  input: Readonly<{
    eventId: string;
    programAddress: string;
    eventPoolAddress: string;
  }>,
) {
  return mutateOwnedGroupEvent((transaction) =>
    bindOwnedGroupEventPoolRecord(transaction, input),
  );
}

export function publishOwnedGroupEvent(eventId: string) {
  return mutateOwnedGroupEvent((transaction) =>
    publishOwnedGroupEventRecord(transaction, eventId),
  );
}

export function withdrawOwnedGroupEventDraft(eventId: string) {
  return mutateOwnedGroupEvent((transaction) =>
    withdrawOwnedGroupEventDraftRecord(transaction, eventId),
  );
}

export async function currentOwnedGroupEventWorkspace() {
  const result = await withAuthorizedActor((transaction, actor) =>
    currentOwnedGroupEventRecords(transaction, actor),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    events: result.value,
  });
}

export function publicGroupEventCatalogue() {
  return publicGroupEventCatalogueRecords();
}

export function publicGroupEventDetail(slug: string) {
  return publicGroupEventDetailRecord(slug);
}

export function recordVerifiedGroupEventPoolProjection(
  evidence: VerifiedGroupEventPoolProjection,
) {
  return recordVerifiedGroupEventPoolProjectionRecord(evidence);
}

export function markGroupEventProjectionAvailability(
  input: Readonly<{
    eventId: string;
    programAddress: string;
    eventPoolAddress: string;
    availability: "pending" | "unavailable";
  }>,
) {
  return markGroupEventProjectionAvailabilityRecord(input);
}

export function recordVerifiedGroupEventContributionProjection(
  evidence: VerifiedGroupEventContributionProjection,
) {
  return recordVerifiedGroupEventContributionProjectionRecord(evidence);
}
