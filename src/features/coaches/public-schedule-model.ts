import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const offsetClockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "shortOffset",
});

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

export function publicScheduleTimeLabel(value: string, offset = false) {
  return (offset ? offsetClockFormat : clockFormat).format(new Date(value));
}

export function publicScheduleTimeRange(startsAt: string, endsAt: string) {
  const zone = (value: string) =>
    offsetClockFormat
      .formatToParts(new Date(value))
      .find((part) => part.type === "timeZoneName")?.value;
  const changesOffset = zone(startsAt) !== zone(endsAt);
  return `${publicScheduleTimeLabel(startsAt, changesOffset)}–${publicScheduleTimeLabel(endsAt, changesOffset)}`;
}
