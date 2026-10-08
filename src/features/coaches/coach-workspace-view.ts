export type CoachWorkspaceView = "schedule" | "bookings";

export function resolveCoachWorkspaceView(
  value: string | string[] | undefined,
): CoachWorkspaceView {
  return value === "bookings" ? "bookings" : "schedule";
}
