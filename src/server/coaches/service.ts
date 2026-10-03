import "server-only";

import type {
  CoachAvailabilityInput,
  CoachAvailabilityWorkspaceState,
  CoachDirectoryState,
  CoachDirectoryFilters,
  CoachEditorState,
  CoachProfileInput,
  PublicCoachProfileState,
} from "@/domain/coaches";
import { isCoachPublicSlug } from "@/domain/coaches";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  CoachAvailabilityConflictError,
  createOwnedCoachAvailabilityRecord,
  currentOwnedCoachAvailabilityRecords,
  publicCoachAvailabilityRecords,
  updateOwnedCoachAvailabilityRecord,
  withdrawOwnedCoachAvailabilityRecord,
} from "@/server/db/coaches/availability-repository";
import {
  activeCoachGymOptions,
  currentOwnedCoachProfileRecord,
  publicCoachDirectoryRecords,
  publicCoachProfileRecord,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";

export async function publicCoachDirectory(
  filters: CoachDirectoryFilters,
): Promise<CoachDirectoryState> {
  try {
    return Object.freeze({
      status: "ready",
      coaches: await publicCoachDirectoryRecords(filters),
      filters,
    });
  } catch {
    return Object.freeze({ status: "unavailable", filters });
  }
}

export async function publicCoachProfile(
  slug: string,
): Promise<PublicCoachProfileState> {
  if (!isCoachPublicSlug(slug)) {
    return Object.freeze({ status: "not-found" });
  }
  try {
    const coach = await publicCoachProfileRecord(slug);
    if (!coach) return Object.freeze({ status: "not-found" });
    const slots = await publicCoachAvailabilityRecords(coach.profileId);
    return Object.freeze({ status: "ready", coach, slots });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

export async function currentCoachEditor(): Promise<CoachEditorState> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    const gyms = await activeCoachGymOptions(transaction, actor);
    return Object.freeze({
      coach,
      gyms,
      ownerDisplayName: owner.displayName,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export async function saveOwnedCoachProfile(input: CoachProfileInput) {
  const result = await withAuthorizedActor((transaction) =>
    upsertOwnedCoachProfileRecord(transaction, input),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, slug: result.value });
}

export async function currentCoachAvailabilityWorkspace(): Promise<CoachAvailabilityWorkspaceState> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    const slots = await currentOwnedCoachAvailabilityRecords(
      transaction,
      actor,
    );
    return Object.freeze({
      coach,
      slots,
      ownerDisplayName: owner.displayName,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

type CoachAvailabilityMutation =
  | Readonly<{
      status: "authorized";
      outcome: "saved" | "conflict";
      slug?: string;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

async function mutateCoachAvailability(
  mutation: Parameters<typeof withAuthorizedActor<string>>[0],
): Promise<CoachAvailabilityMutation> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    if (!coach || coach.visibility !== "visible") {
      return Object.freeze({ outcome: "conflict" as const });
    }
    try {
      await mutation(transaction, actor);
      return Object.freeze({ outcome: "saved" as const, slug: coach.slug });
    } catch (error) {
      if (error instanceof CoachAvailabilityConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export function createOwnedCoachAvailability(input: CoachAvailabilityInput) {
  return mutateCoachAvailability((transaction) =>
    createOwnedCoachAvailabilityRecord(transaction, input),
  );
}

export function updateOwnedCoachAvailability(
  slotId: string,
  input: CoachAvailabilityInput,
) {
  return mutateCoachAvailability((transaction) =>
    updateOwnedCoachAvailabilityRecord(transaction, slotId, input),
  );
}

export function withdrawOwnedCoachAvailability(slotId: string) {
  return mutateCoachAvailability((transaction) =>
    withdrawOwnedCoachAvailabilityRecord(transaction, slotId),
  );
}
