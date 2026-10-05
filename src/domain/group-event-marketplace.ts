import type {
  GroupEventContributionLifecycle,
  GroupEventProjection,
} from "./group-events";
import {
  GROUP_EVENT_MAXIMUM_PARTICIPANTS,
  GROUP_EVENT_MAX_BASE_UNITS,
  GROUP_EVENT_MINIMUM_PARTICIPANTS,
} from "./group-events";

export type GroupEventActorContribution = Readonly<{
  contributionAddress: string;
  participantWalletAddress: string;
  amountBaseUnits: string;
  lifecycleStatus: GroupEventContributionLifecycle;
  transactionSignature: string;
  finalizedAt: string;
}>;

export type GroupEventActorState =
  | Readonly<{
      status: "authorized";
      isCoach: boolean;
      contribution: GroupEventActorContribution | null;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type GroupEventAvailableAction = "fund" | "settle" | "payout" | "refund";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

function dateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) throw new Error("Enter a complete local date and time.");
  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const calendarCheck = new Date(
    Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
    ),
  );
  if (
    calendarCheck.getUTCFullYear() !== desired.year ||
    calendarCheck.getUTCMonth() + 1 !== desired.month ||
    calendarCheck.getUTCDate() !== desired.day ||
    calendarCheck.getUTCHours() !== desired.hour ||
    calendarCheck.getUTCMinutes() !== desired.minute
  ) {
    throw new Error("Enter a valid local date and time.");
  }

  let timestamp = calendarCheck.getTime();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rendered = dateTimeParts(new Date(timestamp), timeZone);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
    );
    const desiredAsUtc = calendarCheck.getTime();
    const adjustment = desiredAsUtc - renderedAsUtc;
    if (adjustment === 0) break;
    timestamp += adjustment;
  }

  const result = new Date(timestamp);
  const rendered = dateTimeParts(result, timeZone);
  if (
    Object.keys(desired).some((key) => {
      const part = key as keyof typeof desired;
      return desired[part] !== rendered[part];
    })
  ) {
    throw new Error(
      "That local time does not exist in this timezone because of a clock change.",
    );
  }
  return result.toISOString();
}

export function eurcToBaseUnits(value: string) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9][0-9]*)(?:\.\d{1,6})?$/u.test(normalized)) {
    throw new Error("Enter a positive EURC amount with at most 6 decimals.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const baseUnits =
    BigInt(whole!) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
  if (baseUnits <= BigInt(0)) throw new Error("Seat price must be positive.");
  if (baseUnits > GROUP_EVENT_MAX_BASE_UNITS) {
    throw new Error("Seat price exceeds the supported event limit.");
  }
  return baseUnits.toString();
}

export function parseGroupEventPoolTerms(
  input: Readonly<{
    seatPriceEurc: string;
    minimumParticipants: number;
    maximumParticipants: number;
    fundingDeadlineLocal: string;
    timeZone: string;
    eventStartsAt: string;
  }>,
  now = new Date(),
) {
  const fundingDeadline = zonedLocalDateTimeToIso(
    input.fundingDeadlineLocal,
    input.timeZone,
  );
  const deadline = new Date(fundingDeadline).getTime();
  const eventStart = new Date(input.eventStartsAt).getTime();
  if (
    !Number.isInteger(input.minimumParticipants) ||
    !Number.isInteger(input.maximumParticipants) ||
    input.minimumParticipants < GROUP_EVENT_MINIMUM_PARTICIPANTS ||
    input.maximumParticipants < input.minimumParticipants ||
    input.maximumParticipants > GROUP_EVENT_MAXIMUM_PARTICIPANTS ||
    deadline <= now.getTime() ||
    !Number.isFinite(eventStart) ||
    deadline >= eventStart
  ) {
    throw new Error(
      "Use 2–50 participants and a future deadline before the event starts.",
    );
  }
  return Object.freeze({
    seatPriceEurcBaseUnits: eurcToBaseUnits(input.seatPriceEurc),
    minimumParticipants: input.minimumParticipants,
    maximumParticipants: input.maximumParticipants,
    fundingDeadline,
  });
}

export function groupEventProgress(event: GroupEventProjection) {
  if (!event.pool)
    return Object.freeze({ percent: 0, label: "Pool not ready" });
  const { participantCount, minimumParticipants } = event.pool;
  const percent = Math.min(
    100,
    Math.round((participantCount / minimumParticipants) * 100),
  );
  return Object.freeze({
    percent,
    label: `${participantCount} of ${minimumParticipants} needed`,
  });
}

export function availableGroupEventActions(
  event: GroupEventProjection,
  actor: GroupEventActorState,
  now = new Date(),
): readonly GroupEventAvailableAction[] {
  if (actor.status !== "authorized" || !event.pool) return Object.freeze([]);
  const pool = event.pool;
  const deadlinePassed =
    new Date(pool.fundingDeadline).getTime() <= now.getTime();
  const actions: GroupEventAvailableAction[] = [];
  if (
    pool.lifecycleStatus === "funding" &&
    !deadlinePassed &&
    pool.participantCount < pool.maximumParticipants &&
    !actor.isCoach &&
    actor.contribution === null
  ) {
    actions.push("fund");
  }
  if (pool.lifecycleStatus === "funding" && deadlinePassed) {
    actions.push("settle");
  }
  if (pool.lifecycleStatus === "succeeded" && actor.isCoach) {
    actions.push("payout");
  }
  if (
    pool.lifecycleStatus === "failed" &&
    actor.contribution !== null &&
    (actor.contribution.lifecycleStatus === "funded" ||
      actor.contribution.lifecycleStatus === "refundable")
  ) {
    actions.push("refund");
  }
  return Object.freeze(actions);
}
