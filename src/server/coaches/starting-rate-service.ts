import "server-only";
import {
  parseCoachStartingRateInput,
  type OwnedStartingRateResult,
  type PublicStartingRateResult,
  type StartingRateFailure,
} from "@/domain/coach-starting-rate";
import { isCoachPublicSlug } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  currentActorProjection,
  type ActorDatabaseTransaction,
} from "@/server/db/authorization/repository";
import {
  CoachStartingRateError,
  ownedCoachStartingRateRecord,
  saveOwnedCoachStartingRateRecord,
  publicCoachStartingRateRecord,
} from "@/server/db/coaches/starting-rate-repository";

async function withRateOwner<T>(
  work: (
    transaction: ActorDatabaseTransaction,
    actor: AuthorizedActor,
  ) => Promise<T>,
): Promise<T | StartingRateFailure> {
  try {
    const result = await withAuthorizedActor(
      async (transaction, actor) => {
        const owner = await currentActorProjection(transaction, actor);
        if (
          !["pending", "approved", "rejected", "demo"].includes(
            owner.coachAccess.status,
          )
        )
          return { status: "forbidden" as const };
        return work(transaction, actor);
      },
      { rethrow: (error) => error instanceof CoachStartingRateError },
    );
    return result.status === "authorized"
      ? result.value
      : { status: result.status === "preview" ? "forbidden" : result.status };
  } catch (error) {
    if (error instanceof CoachStartingRateError)
      return { status: error.status };
    throw error;
  }
}
export async function currentCoachStartingRate(): Promise<OwnedStartingRateResult> {
  return withRateOwner(async (transaction, actor) => {
    const startingRate = await ownedCoachStartingRateRecord(transaction, actor);
    return startingRate
      ? { status: "ready" as const, startingRate }
      : { status: "forbidden" as const };
  });
}
export async function saveCoachStartingRate(
  value: unknown,
): Promise<OwnedStartingRateResult> {
  const input = parseCoachStartingRateInput(value);
  if (!input) return { status: "invalid" };
  return withRateOwner(async (transaction) => ({
    status: "saved" as const,
    startingRate: await saveOwnedCoachStartingRateRecord(
      transaction,
      input.expectedRevision,
      input.amountCents,
      input.currency,
      input.showPublicly,
    ),
  }));
}
export async function publicCoachStartingRate(
  slug: string,
): Promise<PublicStartingRateResult> {
  if (!isCoachPublicSlug(slug)) return { status: "not-found" };
  try {
    const record = await publicCoachStartingRateRecord(slug);
    return record
      ? {
          status: "ready",
          schemaVersion: 1,
          ...(record.startingRate ? { startingRate: record.startingRate } : {}),
        }
      : { status: "not-found" };
  } catch {
    return { status: "unavailable" };
  }
}
