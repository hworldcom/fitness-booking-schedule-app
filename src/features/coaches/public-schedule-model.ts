import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";

export function publicScheduleActorMatches(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
  expected: Readonly<{ subject: string; actorIdentity: string }>,
) {
  return (
    session.status === "signed-in" &&
    session.subject === expected.subject &&
    actor.status === "authorized" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      expected.actorIdentity
  );
}
