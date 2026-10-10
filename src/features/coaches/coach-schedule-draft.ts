import {
  coachAvailabilityCellKey,
  type CoachAvailabilityIsoWeekday,
  type CoachAvailabilityRuleInput,
  type CoachTrainingLocation,
  type OwnedCoachAvailabilityRule,
} from "@/domain/coaches";

export type CoachScheduleDraft = ReadonlyMap<
  string,
  CoachAvailabilityRuleInput
>;

export type CoachScheduleCellUpdate = Readonly<{
  assignments: CoachScheduleDraft;
  outcome: "assigned" | "removed" | "decision-required";
  existing: CoachAvailabilityRuleInput | null;
}>;

export type CoachScheduleCellResolution = "keep" | "move" | "remove";

export function coachScheduleAssignment(
  location: CoachTrainingLocation,
  isoWeekday: CoachAvailabilityIsoWeekday,
  localStartTime: string,
): CoachAvailabilityRuleInput {
  return Object.freeze({
    locationId: location.id,
    locationUpdatedAt: location.updatedAt,
    isoWeekday,
    localStartTime,
  });
}

export function createCoachScheduleDraft(
  rules: readonly OwnedCoachAvailabilityRule[],
): CoachScheduleDraft {
  return new Map(
    rules.map((rule) => [
      coachAvailabilityCellKey(rule),
      Object.freeze({
        locationId: rule.locationId,
        locationUpdatedAt: rule.locationUpdatedAt,
        isoWeekday: rule.isoWeekday,
        localStartTime: rule.localStartTime,
      }),
    ]),
  );
}

export function serializeCoachScheduleDraft(assignments: CoachScheduleDraft) {
  return JSON.stringify(
    Array.from(assignments.values()).toSorted(
      (left, right) =>
        left.isoWeekday - right.isoWeekday ||
        left.localStartTime.localeCompare(right.localStartTime) ||
        left.locationId.localeCompare(right.locationId),
    ),
  );
}

export function toggleCoachScheduleCell(
  assignments: CoachScheduleDraft,
  requested: CoachAvailabilityRuleInput,
): CoachScheduleCellUpdate {
  const key = coachAvailabilityCellKey(requested);
  const existing = assignments.get(key) ?? null;
  if (existing && existing.locationId !== requested.locationId) {
    return Object.freeze({
      assignments,
      outcome: "decision-required",
      existing,
    });
  }

  const next = new Map(assignments);
  if (existing) {
    next.delete(key);
    return Object.freeze({
      assignments: next,
      outcome: "removed",
      existing,
    });
  }

  next.set(key, Object.freeze({ ...requested }));
  return Object.freeze({
    assignments: next,
    outcome: "assigned",
    existing: null,
  });
}

export function resolveCoachScheduleCell(
  assignments: CoachScheduleDraft,
  requested: CoachAvailabilityRuleInput,
  resolution: CoachScheduleCellResolution,
): CoachScheduleDraft {
  if (resolution === "keep") return assignments;

  const next = new Map(assignments);
  const key = coachAvailabilityCellKey(requested);
  if (resolution === "remove") {
    next.delete(key);
  } else {
    next.set(key, Object.freeze({ ...requested }));
  }
  return next;
}
