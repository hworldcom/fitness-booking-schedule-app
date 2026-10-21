import "server-only";
import { ownedSessionTypes } from "@/server/db/coaches/session-type-repository";
import { parseCalendarQuery } from "@/domain/coach-calendar";
import type { CoachCalendarResult } from "@/features/coaches/coach-calendar-model";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { currentOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import { ownedCoachCalendarRecord } from "@/server/db/coaches/calendar-repository";

export async function loadCoachCalendar(
  value: unknown,
  expectedScope?: string,
): Promise<CoachCalendarResult> {
  const query = parseCalendarQuery(value);
  if (!query)
    return {
      status: "invalid",
      message: "Choose a calendar period of up to 42 dates and valid filters.",
    };
  const result = await withAuthorizedActor(async (tx, actor) => {
    const scope = [
      actor.authUserId,
      actor.profileId,
      actor.runId,
      actor.runRole,
    ].join(":");
    if (expectedScope !== undefined && scope !== expectedScope) return null;
    const owner = await currentActorProjection(tx, actor);
    if (!["approved", "demo", "suspended"].includes(owner.coachAccess.status))
      return null;
    const coach = await currentOwnedCoachProfileRecord(tx, actor);
    if (!coach || coach.timezone !== "Europe/Berlin") return null;
    const page = await ownedCoachCalendarRecord(tx, query);
    return {
      scope,
      actorIdentity: [owner.profileSlug, owner.runSlug, owner.role].join(":"),
      locations: coach.locations,
      sessionTypes: await ownedSessionTypes(tx, actor, true),
      mayEditAvailability:
        coach.visibility === "visible" &&
        ["approved", "demo"].includes(owner.coachAccess.status),
      availabilityPausedReason:
        owner.coachAccess.status === "suspended"
          ? ("coach-suspended" as const)
          : coach.visibility === "hidden"
            ? ("profile-hidden" as const)
            : null,
      query,
      page,
    };
  });
  if (result.status === "authorized" && result.value)
    return { status: "ready", data: result.value };
  return result.status === "unavailable" || result.status === "preview"
    ? {
        status: "unavailable",
        message:
          "The calendar could not be verified. Reload to try again; no empty schedule is assumed.",
      }
    : {
        status: "denied",
        message: "Your account or coach access changed. Reload the workspace.",
      };
}
