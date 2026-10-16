import {
  isCoachTrainingLocationId,
  type CoachAvailabilityRuleInput,
} from "./coaches";

export type AvailabilityHour = Readonly<{
  locationId: string;
  locationUpdatedAt: string;
  localStartTime: string;
}>;
export type AvailabilityDate = Readonly<{
  date: string;
  mode: "custom" | "unavailable" | "weekly";
  hours: readonly AvailabilityHour[];
}>;
export type EffectiveAvailabilityCommand = Readonly<{
  operationId: string;
  expectedRevision: number;
}> &
  (
    | Readonly<{ kind: "weekly"; hours: readonly CoachAvailabilityRuleInput[] }>
    | Readonly<{ kind: "dates"; dates: readonly AvailabilityDate[] }>
  );
export type EffectiveAvailabilityPolicy = Readonly<{
  revision: number;
  weeklyHours: readonly CoachAvailabilityRuleInput[];
  dates: readonly AvailabilityDate[];
}>;
export type RetainedAvailabilitySession = Readonly<{
  kind: "private" | "group";
  id: string;
  startsAt: string;
  endsAt: string;
  venue: string;
}>;
export type EffectiveAvailabilityResult =
  | Readonly<{
      outcome: "saved";
      revision: number;
      closedRequestCount: number;
      retainedSessions: readonly RetainedAvailabilitySession[];
    }>
  | Readonly<{
      outcome: "conflict";
      reason: "revision-changed" | "operation-changed";
      revision: number;
    }>;

export function isAvailabilityDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

/** Expand a local editing draft; the database revalidates venue/time eligibility. */
export function expandAvailabilityRanges(
  ranges: readonly Readonly<{
    startTime: string;
    endTime: string;
    locationId: string;
    locationUpdatedAt: string;
  }>[],
): readonly AvailabilityHour[] {
  const hours: AvailabilityHour[] = [];
  const seen = new Set<number>();
  for (const range of ranges) {
    if (
      !/^(?:[01]\d|2[0-2]):00$/.test(range.startTime) ||
      !/^(?:[01]\d|2[0-3]):00$/.test(range.endTime) ||
      !isCoachTrainingLocationId(range.locationId) ||
      !Number.isFinite(Date.parse(range.locationUpdatedAt))
    )
      throw new Error("Availability range is invalid.");
    const start = Number(range.startTime.slice(0, 2));
    const end = Number(range.endTime.slice(0, 2));
    if (start >= end)
      throw new Error("Availability range must end after it starts.");
    for (let hour = start; hour < end; hour++) {
      if (seen.has(hour)) throw new Error("Availability ranges overlap.");
      seen.add(hour);
      hours.push(
        Object.freeze({
          locationId: range.locationId,
          locationUpdatedAt: range.locationUpdatedAt,
          localStartTime: `${String(hour).padStart(2, "0")}:00`,
        }),
      );
    }
  }
  return Object.freeze(
    hours.sort((a, b) => a.localStartTime.localeCompare(b.localStartTime)),
  );
}
