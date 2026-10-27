import type { ActorSnapshot } from "./actor-contracts";

export type WorkspaceView = "athlete" | "coach";

export function hasCoachWorkspace(actor: ActorSnapshot) {
  return (
    actor.status === "authorized" &&
    (actor.coachAccessStatus === "approved" ||
      actor.coachAccessStatus === "demo" ||
      actor.coachAccessStatus === "suspended")
  );
}

function within(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

export function workspaceViewForPath(path: string): WorkspaceView | null {
  if (within(path, "/coach") || within(path, "/profile/coach")) return "coach";
  if (
    within(path, "/sessions") ||
    within(path, "/my-coaches") ||
    within(path, "/profile")
  )
    return "athlete";
  return null;
}

export function resolveWorkspaceView(
  actor: ActorSnapshot,
  path: string,
  preference: unknown = null,
): WorkspaceView {
  if (!hasCoachWorkspace(actor)) return "athlete";
  return (
    workspaceViewForPath(path) ?? (preference === "coach" ? "coach" : "athlete")
  );
}

export function workspaceViewStorageKey(actor: ActorSnapshot) {
  return actor.status === "authorized" && hasCoachWorkspace(actor)
    ? `movx-workspace-view:${actor.demoRun.slug}:${actor.profile.slug}`
    : null;
}

export function workspaceHref(view: WorkspaceView) {
  return view === "coach" ? "/coach" : "/sessions/calendar";
}

export function workspaceProfileHref(
  actor: ActorSnapshot,
  view: WorkspaceView,
) {
  return view === "coach" &&
    actor.status === "authorized" &&
    (actor.coachAccessStatus === "approved" ||
      actor.coachAccessStatus === "demo")
    ? "/profile/coach"
    : "/profile";
}

export function workspaceSwitchHref(
  actor: ActorSnapshot,
  pathname: string,
  target: WorkspaceView,
) {
  const view = hasCoachWorkspace(actor) ? target : "athlete";
  const profile = workspaceProfileHref(actor, view);
  if (
    within(pathname, "/profile") &&
    (view === "athlete" || profile === "/profile/coach")
  )
    return profile;
  return workspaceHref(view);
}
