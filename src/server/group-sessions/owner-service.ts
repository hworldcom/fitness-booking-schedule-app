import "server-only";
import { ownedSessionTypes } from "@/server/db/coaches/session-type-repository";
import {
  parseGroupSessionCommand,
  type GroupCursor,
} from "@/domain/group-sessions";
import type {
  CoachEventContext,
  OwnerMutation,
} from "@/features/coach-events/contract";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { currentOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  groupSessionCommandRecord,
  GroupSessionConflictError,
} from "@/server/db/group-sessions/repository";

async function withOwner<T>(
  work: (
    tx: ActorDatabaseTransaction,
    context: CoachEventContext,
  ) => Promise<T>,
  expectedScope?: string,
) {
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) => {
        const scope = `${actor.runId}:${actor.profileId}:${actor.authUserId}`;
        if (expectedScope !== undefined && expectedScope !== scope)
          return { status: "actor-changed" as const };
        const owner = await currentActorProjection(tx, actor);
        if (
          !["approved", "demo", "suspended"].includes(owner.coachAccess.status)
        )
          return { status: "forbidden" as const };
        const coach = await currentOwnedCoachProfileRecord(tx, actor);
        if (!coach) return { status: "forbidden" as const };
        const context: CoachEventContext = {
          scope,
          identity: [owner.profileSlug, owner.runSlug, owner.role].join(":"),
          sessionTypes: await ownedSessionTypes(tx, actor, true),
          canDraft: ["approved", "demo"].includes(owner.coachAccess.status),
          canPublish:
            coach.visibility === "visible" &&
            ["approved", "demo"].includes(owner.coachAccess.status),
          disciplines: coach.disciplines,
          locations: coach.locations
            .filter((location) => location.status === "active")
            .map((location) => ({
              id: location.id,
              name: location.publicName,
              label: location.location.label,
            })),
        };
        return {
          status: "ready" as const,
          context,
          value: await work(tx, context),
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
export async function ownerEventContext() {
  return withOwner(async () => null);
}
export async function ownedGroupEvents(after: GroupCursor | null) {
  if (!parseGroupSessionCommand({ action: "owner-list", args: { after } }))
    return { status: "invalid" as const };
  return withOwner((tx) =>
    groupSessionCommandRecord(tx, { action: "owner-list", args: { after } }),
  );
}
export async function ownedGroupEvent(
  id: string,
  after: GroupCursor | null = null,
) {
  if (!parseGroupSessionCommand({ action: "roster", args: { id, after } }))
    return { status: "invalid" as const };
  return withOwner(async (tx) => {
    // Owner-only roster authorization runs first. A public detail response never grants owner access.
    const roster = await groupSessionCommandRecord(tx, {
      action: "roster",
      args: { id, after },
    });
    const detail = await groupSessionCommandRecord(tx, {
      action: "detail",
      args: { id },
    });
    return { session: detail.session, roster };
  });
}
export async function changeOwnedGroupEvent(
  command: OwnerMutation,
  scope: string,
) {
  const parsed = parseGroupSessionCommand(command);
  if (
    !parsed ||
    !["save-draft", "publish", "confirm", "cancel", "delete-draft"].includes(
      parsed.action,
    ) ||
    typeof scope !== "string" ||
    !/^[a-f0-9:-]{100,160}$/i.test(scope)
  )
    return { status: "invalid" as const };
  const mutation = parsed as OwnerMutation;
  return withOwner(async (tx, context) => {
    if (
      (mutation.action === "save-draft" && !context.canDraft) ||
      (["publish", "confirm"].includes(mutation.action) && !context.canPublish)
    )
      return { outcome: "forbidden" as const };
    return groupSessionCommandRecord(tx, mutation);
  }, scope);
}
