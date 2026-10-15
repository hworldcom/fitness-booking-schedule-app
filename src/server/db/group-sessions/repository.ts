import "server-only";
import { sql } from "drizzle-orm";
import {
  parseGroupSessionResult,
  type GroupSessionCommand,
  type GroupResultMap,
  type PublicGroupQuery,
} from "@/domain/group-sessions";
import type { ActorDatabaseTransaction } from "../authorization/repository";
import { withDatabaseConnection } from "../client";

export class GroupSessionConflictError extends Error {
  constructor() {
    super("The group session changed or is unavailable.");
  }
}
function translateConflict(error: unknown): never {
  let current = error;
  for (let depth = 0; depth < 8; depth++) {
    if (!current || typeof current !== "object") break;
    const e = current as { code?: string; cause?: unknown };
    if (
      [
        "P0001",
        "23505",
        "23514",
        "23503",
        "23502",
        "22P02",
        "22003",
        "22007",
        "22008",
      ].includes(e.code ?? "")
    )
      throw new GroupSessionConflictError();
    current = e.cause;
  }
  throw error;
}
export async function groupSessionCommandRecord<C extends GroupSessionCommand>(
  tx: ActorDatabaseTransaction,
  command: C,
): Promise<GroupResultMap[C["action"]]> {
  try {
    const rows = await tx.execute<{ result: unknown }>(
      sql`select app.group_session_command(${command.action}::text,${JSON.stringify(command.args)}::jsonb) result`,
    );
    if (rows.length !== 1) throw new GroupSessionConflictError();
    return parseGroupSessionResult<C["action"]>(command.action, rows[0].result);
  } catch (error) {
    return translateConflict(error);
  }
}
export async function publicGroupSessionRecord(query: PublicGroupQuery) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{ result: unknown }>(
      sql`select app.public_group_sessions(${query.action}::text,${JSON.stringify(query.args)}::jsonb) result`,
    );
    if (rows.length !== 1) throw new GroupSessionConflictError();
    return query.action === "list"
      ? parseGroupSessionResult("public-list", rows[0].result)
      : parseGroupSessionResult("public-detail", rows[0].result);
  });
}
