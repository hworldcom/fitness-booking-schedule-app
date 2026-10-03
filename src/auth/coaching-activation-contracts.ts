export type CoachingActivationSnapshot = Readonly<{
  status: "activated" | "signed-out" | "forbidden" | "unavailable";
}>;

export const UNAVAILABLE_COACHING_ACTIVATION = Object.freeze({
  status: "unavailable",
} as const) satisfies CoachingActivationSnapshot;

export function isCoachingActivationSnapshot(
  value: unknown,
): value is CoachingActivationSnapshot {
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
    value.status === "activated" ||
    value.status === "signed-out" ||
    value.status === "forbidden" ||
    value.status === "unavailable"
  );
}
