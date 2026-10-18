import "server-only";
import {
  parseSessionTypeCommand,
  type SessionTypeResult,
} from "@/domain/session-types";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  mutateSessionType,
  ownedSessionTypes,
  ownedSessionTypeLocations,
  SessionTypeError,
} from "@/server/db/coaches/session-type-repository";
export async function coachSessionTypes(
  input?: unknown,
): Promise<SessionTypeResult> {
  const command =
    input === undefined ? undefined : parseSessionTypeCommand(input);
  if (command === null) return { status: "invalid" };
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) => {
        const owner = await currentActorProjection(tx, actor);
        if (
          !["pending", "approved", "rejected", "demo"].includes(
            owner.coachAccess.status,
          )
        )
          return { status: "forbidden" as const };
        if (command) await mutateSessionType(tx, command);
        return {
          status: command ? ("saved" as const) : ("ready" as const),
          types: await ownedSessionTypes(tx, actor),
          locations: await ownedSessionTypeLocations(tx, actor),
        };
      },
      { rethrow: (error) => error instanceof SessionTypeError },
    );
    return result.status === "authorized"
      ? result.value
      : { status: result.status === "preview" ? "forbidden" : result.status };
  } catch (error) {
    if (error instanceof SessionTypeError) return { status: error.status };
    return { status: "unavailable" };
  }
}
