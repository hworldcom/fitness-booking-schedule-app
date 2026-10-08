import type { CoachApplicationStatus } from "@/domain/coaches";

export type CoachApplicationSubmissionSnapshot = Readonly<{
  status: CoachApplicationStatus | "signed-out" | "forbidden" | "unavailable";
}>;

export const UNAVAILABLE_COACH_APPLICATION_SUBMISSION = Object.freeze({
  status: "unavailable",
} as const) satisfies CoachApplicationSubmissionSnapshot;

export function isCoachApplicationSubmissionSnapshot(
  value: unknown,
): value is CoachApplicationSubmissionSnapshot {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("status" in value)
  ) {
    return false;
  }
  return (
    value.status === "pending" ||
    value.status === "approved" ||
    value.status === "rejected" ||
    value.status === "suspended" ||
    value.status === "signed-out" ||
    value.status === "forbidden" ||
    value.status === "unavailable"
  );
}
