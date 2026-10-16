import "server-only";

import type {
  CoachAvailabilityInput,
  CoachAvailabilityRuleInput,
  CoachAvailabilityWorkspaceState,
  CoachDirectoryState,
  CoachDirectoryFilters,
  CoachEditorState,
  CoachProfileInput,
  CoachTrainingLocationInput,
  PublicCoachProfileState,
} from "@/domain/coaches";
import { isCoachPublicSlug, isCoachTrainingLocationId } from "@/domain/coaches";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  CoachAvailabilityConflictError,
  createOwnedCoachAvailabilityRecord,
  createOwnedCoachAvailabilityRuleRecord,
  currentOwnedCoachAvailabilityRecords,
  currentOwnedCoachAvailabilityRuleRecords,
  publicCoachAvailabilityRecords,
  removeOwnedCoachAvailabilityRuleRecord,
  replaceOwnedCoachAvailabilityRuleRecords,
  updateOwnedCoachAvailabilityRecord,
  withdrawOwnedCoachAvailabilityRecord,
} from "@/server/db/coaches/availability-repository";
import {
  activeCoachGymOptions,
  CoachTrainingLocationConflictError,
  createOwnedCoachTrainingLocationRecord,
  currentOwnedCoachProfileRecord,
  deactivateOwnedCoachTrainingLocationRecord,
  publicCoachDirectoryRecords,
  publicCoachProfileRecord,
  setOwnedCoachPrimaryLocationRecord,
  updateOwnedCoachTrainingLocationRecord,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";

function canPrepareCoachProfile(status: string) {
  return (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "demo"
  );
}

function canOperateCoachSchedule(status: string) {
  return status === "approved" || status === "demo";
}

export async function publicCoachDirectory(
  filters: CoachDirectoryFilters,
): Promise<CoachDirectoryState> {
  try {
    return Object.freeze({
      status: "ready",
      entries: await publicCoachDirectoryRecords(filters),
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
    const mayPrepare = canPrepareCoachProfile(owner.coachAccess.status);
    const coach = mayPrepare
      ? await currentOwnedCoachProfileRecord(transaction, actor)
      : null;
    const gyms = mayPrepare
      ? await activeCoachGymOptions(transaction, actor)
      : Object.freeze([]);
    return Object.freeze({
      coach,
      gyms,
      ownerDisplayName: owner.displayName,
      coachAccess: owner.coachAccess,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export async function currentCoachAccess() {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    return owner.coachAccess;
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    coachAccess: result.value,
  });
}

export async function saveOwnedCoachProfile(input: CoachProfileInput) {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    if (!canPrepareCoachProfile(owner.coachAccess.status)) {
      return Object.freeze({ outcome: "application-required" as const });
    }
    if (
      input.visibility === "visible" &&
      !canOperateCoachSchedule(owner.coachAccess.status)
    ) {
      return Object.freeze({ outcome: "approval-required" as const });
    }
    return Object.freeze({
      outcome: "saved" as const,
      slug: await upsertOwnedCoachProfileRecord(transaction, input),
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

type CoachTrainingLocationMutation =
  | Readonly<{
      status: "authorized";
      outcome: "saved" | "conflict";
      value?: string;
      slug?: string;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

async function mutateCoachTrainingLocation(
  mutation: Parameters<typeof withAuthorizedActor<string>>[0],
): Promise<CoachTrainingLocationMutation> {
  try {
    const result = await withAuthorizedActor(
      async (transaction, actor) => {
        const owner = await currentActorProjection(transaction, actor);
        if (!canPrepareCoachProfile(owner.coachAccess.status)) {
          return Object.freeze({ outcome: "conflict" as const });
        }
        const coach = await currentOwnedCoachProfileRecord(transaction, actor);
        if (!coach) return Object.freeze({ outcome: "conflict" as const });
        return Object.freeze({
          outcome: "saved" as const,
          value: await mutation(transaction, actor),
          slug: coach.slug,
        });
      },
      {
        rethrow: (error) => error instanceof CoachTrainingLocationConflictError,
      },
    );
    if (result.status !== "authorized") return result;
    return Object.freeze({ status: "authorized" as const, ...result.value });
  } catch (error) {
    if (error instanceof CoachTrainingLocationConflictError) {
      return Object.freeze({
        status: "authorized" as const,
        outcome: "conflict" as const,
      });
    }
    throw error;
  }
}

export function createOwnedCoachTrainingLocation(
  input: CoachTrainingLocationInput,
) {
  return mutateCoachTrainingLocation((transaction) =>
    createOwnedCoachTrainingLocationRecord(transaction, input),
  );
}

export function updateOwnedCoachTrainingLocation(
  locationId: string,
  expectedUpdatedAt: string,
  input: CoachTrainingLocationInput,
) {
  return mutateCoachTrainingLocation((transaction) => {
    if (!isCoachTrainingLocationId(locationId)) {
      throw new CoachTrainingLocationConflictError();
    }
    return updateOwnedCoachTrainingLocationRecord(
      transaction,
      locationId,
      expectedUpdatedAt,
      input,
    );
  });
}

export function setOwnedCoachPrimaryLocation(
  locationId: string,
  expectedLocationUpdatedAt: string,
  expectedPrimaryLocationId: string,
  expectedPrimaryUpdatedAt: string,
) {
  return mutateCoachTrainingLocation((transaction) => {
    if (
      !isCoachTrainingLocationId(locationId) ||
      !isCoachTrainingLocationId(expectedPrimaryLocationId)
    ) {
      throw new CoachTrainingLocationConflictError();
    }
    return setOwnedCoachPrimaryLocationRecord(
      transaction,
      locationId,
      expectedLocationUpdatedAt,
      expectedPrimaryLocationId,
      expectedPrimaryUpdatedAt,
    );
  });
}

export function deactivateOwnedCoachTrainingLocation(
  locationId: string,
  expectedLocationUpdatedAt: string,
  replacement: Readonly<{ id: string; expectedUpdatedAt: string }> | null,
) {
  return mutateCoachTrainingLocation((transaction) => {
    if (
      !isCoachTrainingLocationId(locationId) ||
      (replacement !== null && !isCoachTrainingLocationId(replacement.id))
    ) {
      throw new CoachTrainingLocationConflictError();
    }
    return deactivateOwnedCoachTrainingLocationRecord(
      transaction,
      locationId,
      expectedLocationUpdatedAt,
      replacement,
    );
  });
}

export async function submitCurrentCoachApplication() {
  const result = await withAuthorizedActor((transaction) =>
    submitOwnedCoachApplicationRecord(transaction),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: result.value });
}

export async function currentCoachAvailabilityWorkspace(
  includeOccurrences = true,
): Promise<CoachAvailabilityWorkspaceState> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    const coach =
      owner.coachAccess.status === "not-applied"
        ? null
        : await currentOwnedCoachProfileRecord(transaction, actor);
    const mayOperate = canOperateCoachSchedule(owner.coachAccess.status);
    const slots =
      mayOperate && includeOccurrences
        ? await currentOwnedCoachAvailabilityRecords(transaction, actor)
        : Object.freeze([]);
    const rules = mayOperate
      ? await currentOwnedCoachAvailabilityRuleRecords(transaction, actor)
      : Object.freeze([]);
    return Object.freeze({
      coach,
      rules,
      slots,
      actorScope: [
        actor.authUserId,
        actor.profileId,
        actor.runId,
        actor.runRole,
      ].join(":"),
      ownerDisplayName: owner.displayName,
      coachAccess: owner.coachAccess,
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
    const owner = await currentActorProjection(transaction, actor);
    if (!canOperateCoachSchedule(owner.coachAccess.status)) {
      return Object.freeze({ outcome: "conflict" as const });
    }
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

export function createOwnedCoachAvailabilityRule(
  input: CoachAvailabilityRuleInput,
) {
  return mutateCoachAvailability((transaction) =>
    createOwnedCoachAvailabilityRuleRecord(transaction, input),
  );
}

export function removeOwnedCoachAvailabilityRule(ruleId: string) {
  return mutateCoachAvailability((transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, ruleId),
  );
}

export async function replaceOwnedCoachAvailabilityRules(
  rules: readonly CoachAvailabilityRuleInput[],
  expectedRules: readonly CoachAvailabilityRuleInput[],
): Promise<CoachAvailabilityMutation> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    if (!canOperateCoachSchedule(owner.coachAccess.status)) {
      return Object.freeze({ outcome: "conflict" as const });
    }
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    if (!coach || coach.visibility !== "visible") {
      return Object.freeze({ outcome: "conflict" as const });
    }
    const ruleCount = await replaceOwnedCoachAvailabilityRuleRecords(
      transaction,
      rules,
      expectedRules,
    );
    return Object.freeze({
      outcome: ruleCount === -1 ? ("conflict" as const) : ("saved" as const),
      slug: coach.slug,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}
