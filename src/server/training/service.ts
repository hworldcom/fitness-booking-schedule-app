import "server-only";
import {
  TrainingDatabaseError,
  trainingCommandRecord,
} from "@/server/db/training/repository";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  parseTrainingPage,
  validTrainingCommand,
  type TrainingResult,
} from "@/training/contracts";

export async function trainingCommand(
  input: unknown,
  expectedScope?: string,
): Promise<TrainingResult> {
  if (!validTrainingCommand(input)) return { status: "invalid" };
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) => {
        const owner = await currentActorProjection(tx, actor);
        const scope = `${owner.runSlug}:${owner.profileSlug}`;
        if (expectedScope !== undefined && expectedScope !== scope)
          return { status: "actor-changed" as const };
        const value = await trainingCommandRecord(tx, input);
        return {
          status: "ready" as const,
          scope,
          value:
            input.action === "list"
              ? parseTrainingPage(value)
              : { saved: true as const },
        };
      },
      { rethrow: (error) => error instanceof TrainingDatabaseError },
    );
    return result.status === "authorized" ? result.value : result;
  } catch (error) {
    // Known SQL failures must escape the actor transaction before translation.
    // Returning from an aborted transaction would turn a rejection into a503.
    if (error instanceof TrainingDatabaseError) return { status: error.status };
    throw error;
  }
}
