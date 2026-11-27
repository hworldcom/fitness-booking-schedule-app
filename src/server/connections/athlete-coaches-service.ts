import "server-only";
import {
  isAthleteCoachFilter,
  isAthleteCoachCursor,
  type AthleteCoachFilter,
} from "@/domain/athlete-coaches";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { athleteCoachesPageRecord } from "@/server/db/connections/athlete-coaches-repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";

function ownerScope(actor: AuthorizedActor) {
  return [actor.authUserId, actor.profileId, actor.runId, actor.runRole].join(
    ":",
  );
}
export async function currentAthleteCoachWorkspace(
  filter: AthleteCoachFilter | null,
) {
  const result = await withAuthorizedActor(async (tx, actor) => {
    const owner = await currentActorProjection(tx, actor);
    return {
      subject: actor.authUserId,
      actorIdentity: [owner.profileSlug, owner.runSlug, owner.role].join(":"),
      scope: ownerScope(actor),
      page: filter === null ? null : await athleteCoachesPageRecord(tx, filter),
    };
  });
  return result.status === "authorized"
    ? { status: "authorized" as const, ...result.value }
    : result;
}
export async function currentAthleteCoaches(
  scope: unknown,
  filter: unknown,
  cursor: unknown = null,
) {
  if (
    typeof scope !== "string" ||
    scope.length > 180 ||
    !isAthleteCoachFilter(filter) ||
    (cursor !== null && !isAthleteCoachCursor(cursor))
  )
    return { status: "invalid" as const };
  const result = await withAuthorizedActor(async (tx, actor) => {
    if (scope !== ownerScope(actor)) return { status: "forbidden" as const };
    return {
      status: "ready" as const,
      page: await athleteCoachesPageRecord(tx, filter, cursor),
    };
  });
  return result.status === "authorized" ? result.value : result;
}
