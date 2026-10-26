import "server-only";
import { trainingCommandRecord } from "@/server/db/training/repository";
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
  const result = await withAuthorizedActor(async (tx, actor) => {
    const owner = await currentActorProjection(tx, actor);
    const scope = `${owner.runSlug}:${owner.profileSlug}`;
    if (expectedScope !== undefined && expectedScope !== scope)
      return { status: "actor-changed" as const };
    try {
      const value = await trainingCommandRecord(tx, input);
      return {
        status: "ready" as const,
        scope,
        value:
          input.action === "list"
            ? parseTrainingPage(value)
            : { saved: true as const },
      };
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      const code = e.code ?? e.cause?.code;
      if (code === "40001" || code === "23505")
        return { status: "conflict" as const };
      if (["22023", "22007", "22008", "22P02", "23514"].includes(code ?? ""))
        return { status: "invalid" as const };
      throw error;
    }
  });
  return result.status === "authorized" ? result.value : result;
}
