export type CoachWorkspaceView = "schedule" | "bookings";
export type CoachWorkspaceDestination = CoachWorkspaceView | "events";

export function resolveCoachWorkspaceView(
  value: string | string[] | undefined,
): CoachWorkspaceView {
  return value === "bookings" ? "bookings" : "schedule";
}

export function selectedCoachWorkspaceDestination(
  path: string,
  viewValues: readonly string[],
): CoachWorkspaceDestination | null {
  const within = (root: string) => path === root || path.startsWith(`${root}/`);
  if (within("/coach/events")) return "events";
  if (within("/coach/sessions") || within("/coach/athletes")) return "bookings";
  if (path !== "/coach") return null;
  return resolveCoachWorkspaceView(
    viewValues.length === 1 ? viewValues[0] : undefined,
  );
}
