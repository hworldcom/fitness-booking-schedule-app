import "server-only";
import {
  isCoachAthleteFilter,
  isCoachAthleteCursor,
} from "@/domain/coach-athletes";
import { withAuthorizedActor } from "@/server/authorization/service";
import { coachAthletesPageRecord } from "@/server/db/connections/coach-athletes-repository";

export async function currentCoachAthletes(
  scope: unknown,
  filter: unknown,
  cursor: unknown = null,
) {
  if (
    typeof scope !== "string" ||
    scope.length > 180 ||
    !isCoachAthleteFilter(filter) ||
    (cursor !== null && !isCoachAthleteCursor(cursor))
  )
    return { status: "invalid" as const };
  const result = await withAuthorizedActor(async (tx, actor) => {
    if (
      [actor.authUserId, actor.profileId, actor.runId, actor.runRole].join(
        ":",
      ) !== scope
    )
      return { status: "forbidden" as const };
    return {
      status: "ready" as const,
      page: await coachAthletesPageRecord(tx, filter, cursor),
    };
  });
  return result.status === "authorized" ? result.value : result;
}
