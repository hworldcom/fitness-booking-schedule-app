import "server-only";
import {
  parseGroupSessionCommand,
  type GroupCursor,
  type GroupSessionCommand,
} from "@/domain/group-sessions";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  groupSessionCommandRecord,
  GroupSessionConflictError,
} from "@/server/db/group-sessions/repository";

async function execute<C extends GroupSessionCommand>(
  command: C,
  expectedScope?: string,
) {
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) => {
        const scope = `${actor.runId}:${actor.profileId}:${actor.authUserId}`;
        if (expectedScope !== undefined && scope !== expectedScope)
          return { status: "actor-changed" as const };
        return {
          status: "ready" as const,
          scope,
          value: await groupSessionCommandRecord(tx, command),
        };
      },
      { rethrow: (error) => error instanceof GroupSessionConflictError },
    );
    return result.status === "authorized"
      ? result.value
      : { status: result.status };
  } catch (error) {
    if (error instanceof GroupSessionConflictError)
      return { status: "conflict" as const };
    throw error;
  }
}
export async function athleteGroupHistory(after: GroupCursor | null) {
  if (!parseGroupSessionCommand({ action: "registrations", args: { after } }))
    return { status: "invalid" as const };
  return execute({ action: "registrations", args: { after } });
}
export async function athleteEventDetail(id: string) {
  if (!parseGroupSessionCommand({ action: "detail", args: { id } }))
    return { status: "invalid" as const };
  return execute({ action: "detail", args: { id } });
}
export async function changeAthleteParticipation(
  command: Extract<GroupSessionCommand, { action: "join" | "withdraw" }>,
  scope: string,
) {
  const parsed = parseGroupSessionCommand(command);
  if (
    !parsed ||
    (parsed.action !== "join" && parsed.action !== "withdraw") ||
    typeof scope !== "string" ||
    !scope ||
    scope.length > 160
  )
    return { status: "invalid" as const };
  return execute(parsed, scope);
}
