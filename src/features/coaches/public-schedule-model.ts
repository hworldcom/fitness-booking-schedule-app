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

export function publicScheduleDateLabel(date: string, short = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00Z`));
}
