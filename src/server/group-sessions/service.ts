import "server-only";
import {
  parseGroupSessionCommand,
  parsePublicGroupQuery,
} from "@/domain/group-sessions";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  groupSessionCommandRecord,
  publicGroupSessionRecord,
  GroupSessionConflictError,
} from "@/server/db/group-sessions/repository";

export async function currentGroupSessionCommand(input: unknown) {
  const command = parseGroupSessionCommand(input);
  if (!command) return { status: "invalid" as const };
  try {
    const result = await withAuthorizedActor(
      (tx) => groupSessionCommandRecord(tx, command),
      { rethrow: (error) => error instanceof GroupSessionConflictError },
    );
    return result.status === "authorized"
      ? { status: "ready" as const, value: result.value }
      : { status: result.status };
  } catch (error) {
    if (error instanceof GroupSessionConflictError)
      return { status: "conflict" as const };
    throw error;
  }
}
export async function publicGroupSessions(input: unknown) {
  const query = parsePublicGroupQuery(input);
  if (!query) return { status: "invalid" as const };
  try {
    return {
      status: "ready" as const,
      value: await publicGroupSessionRecord(query),
    };
  } catch {
    return { status: "unavailable" as const };
  }
}
