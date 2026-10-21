import "server-only";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  ownedEffectiveAvailabilityRecord,
  saveOwnedEffectiveAvailabilityRecord,
} from "@/server/db/coaches/effective-availability-repository";
import { CoachAvailabilityConflictError } from "@/server/db/coaches/availability-repository";
import type {
  AvailabilityLoadResult,
  AvailabilityActionResult,
} from "@/availability/contracts";
import {
  berlinAvailabilityDate,
  type EffectiveAvailabilityCommand,
} from "@/domain/effective-availability";

export async function loadAvailabilityEditor(
  from: string,
  through: string,
  expectedScope?: string,
): Promise<AvailabilityLoadResult> {
  const result = await withAuthorizedActor(async (tx, actor) => {
    const scope = [
      actor.authUserId,
      actor.profileId,
      actor.runId,
      actor.runRole,
    ].join(":");
    if (expectedScope !== undefined && scope !== expectedScope) return null;
    const owner = await currentActorProjection(tx, actor);
    const coach = await currentOwnedCoachProfileRecord(tx, actor);
    if (
      !["approved", "demo"].includes(owner.coachAccess.status) ||
      coach?.visibility !== "visible" ||
      coach.timezone !== "Europe/Berlin"
    )
      return null;
    const policy = await ownedEffectiveAvailabilityRecord(tx, from, through);
    return {
      scope,
      actorIdentity: [owner.profileSlug, owner.runSlug, owner.role].join(":"),
      policy,
      locations: coach.locations,
      today: berlinAvailabilityDate(new Date()),
    };
  });
  if (result.status === "authorized" && result.value)
    return { status: "ready", data: result.value };
  return result.status === "unavailable" || result.status === "preview"
    ? {
        status: "unavailable",
        message: "Availability could not be loaded. Reload to try again.",
      }
    : {
        status: "denied",
        message:
          "Your account or coach access changed. Reload the workspace before editing.",
      };
}
export async function changeAvailabilityEditor(
  command: EffectiveAvailabilityCommand,
  scope: string,
  preview: boolean,
): Promise<AvailabilityActionResult> {
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) => {
        if (
          [actor.authUserId, actor.profileId, actor.runId, actor.runRole].join(
            ":",
          ) !== scope
        )
          return null;
        const owner = await currentActorProjection(tx, actor);
        const coach = await currentOwnedCoachProfileRecord(tx, actor);
        if (
          !["approved", "demo"].includes(owner.coachAccess.status) ||
          coach?.visibility !== "visible"
        )
          return null;
        // Let the typed validation error trigger rollback before translating it.
        return saveOwnedEffectiveAvailabilityRecord(tx, command, preview);
      },
      { rethrow: (error) => error instanceof CoachAvailabilityConflictError },
    );
    if (result.status === "authorized") {
      if (result.value === null)
        return {
          status: "denied",
          message: "The signed-in account changed. Reload before editing.",
        };
      return { status: "ready", result: result.value };
    }
    return result.status === "unavailable"
      ? {
          status: "unavailable",
          message: preview
            ? "The availability review could not be loaded. Your draft is unchanged; no availability was saved by this preview."
            : "The outcome could not be verified. Retry this exact save before assuming it was applied.",
        }
      : {
          status: "denied",
          message: "Sign in again and review your coach access before editing.",
        };
  } catch (error) {
    if (error instanceof CoachAvailabilityConflictError)
      return {
        status: "invalid",
        message:
          "These hours could not be saved. Review the dates and current venues; your draft is still here.",
      };
    throw error;
  }
}
