import "server-only";
import { sql } from "drizzle-orm";
import {
  parseSessionTypes,
  type SessionTypeCommand,
} from "@/domain/session-types";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";
export class SessionTypeError extends Error {
  constructor(public readonly status: "invalid" | "conflict" | "forbidden") {
    super("Session type operation failed.");
  }
}
export function sessionMutationError(error: unknown): never {
  let e: unknown = error;
  for (let depth = 0; depth < 6 && e && typeof e === "object"; depth++) {
    const v = e as { code?: string; cause?: unknown };
    if (v.code === "42501") throw new SessionTypeError("forbidden");
    if (
      [
        "22023",
        "22003",
        "23514",
        "23502",
        "22P02",
        "22007",
        "22008",
        "23503",
      ].includes(v.code ?? "")
    )
      throw new SessionTypeError("invalid");
    if (["P0001", "23505", "23P01", "40001", "40P01"].includes(v.code ?? ""))
      throw new SessionTypeError("conflict");
    e = v.cause;
  }
  throw error;
}
export async function ownedSessionTypes(
  tx: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  allowUninstalled = false,
) {
  if (allowUninstalled) {
    const [capability] = await tx.execute<{ installed: boolean }>(
      sql`select to_regclass('app.coach_session_types') is not null installed`,
    );
    if (capability?.installed === false) return [];
    if (capability?.installed !== true)
      throw new Error("Session type capability unavailable.");
  }
  const rows = await tx.execute<{ types: unknown }>(
    sql`select coalesce(jsonb_agg(app.session_type_json(t) order by t.archived,t.name,t.id),'[]'::jsonb) as types from app.coach_session_types t where t.run_id=${actor.runId}::uuid and t.coach_profile_id=${actor.profileId}::uuid`,
  );
  return parseSessionTypes(rows[0].types);
}
export async function mutateSessionType(
  tx: ActorDatabaseTransaction,
  input: SessionTypeCommand,
) {
  const { commandId, ...payload } = input;
  try {
    const rows = await tx.execute<{ types: unknown }>(
      sql`select app.mutate_owned_coach_session_type(${commandId}::uuid,${JSON.stringify(payload)}::jsonb) as types`,
    );
    return parseSessionTypes(rows[0].types);
  } catch (error) {
    return sessionMutationError(error);
  }
}
export async function publicSessionTypes(slug: string) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{ types: unknown }>(
      sql`select app.public_coach_session_types(${slug}) as types`,
    );
    return parseSessionTypes(rows[0].types);
  });
}

export async function ownedSessionTypeLocations(
  tx: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  return [
    ...(await tx.execute<{ id: string; name: string }>(
      sql`select id,public_name as name from app.coach_training_locations where run_id=${actor.runId}::uuid and profile_id=${actor.profileId}::uuid and status='active' order by sort_order,id`,
    )),
  ];
}
