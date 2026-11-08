import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";

export function connectionCountIdentity(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
) {
  return session.status === "signed-in" && actor.status === "authorized"
    ? [
        session.subject,
        actor.profile.slug,
        actor.demoRun.slug,
        actor.role,
      ].join(":")
    : null;
}
