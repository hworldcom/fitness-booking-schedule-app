import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";

export function myCoachesOwnerAccess(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
  expected: { subject: string; actorIdentity: string },
) {
  if (
    session.status === "unavailable" ||
    (session.status === "signed-in" && actor.status === "unavailable")
  )
    return "pending";
  return session.status === "signed-in" &&
    session.subject === expected.subject &&
    actor.status === "authorized" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      expected.actorIdentity
    ? "allowed"
    : "denied";
}
