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
  if (within(path, "/sessions") || within(path, "/my-coaches"))
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
  return view === "coach" ? "/coach" : "/sessions";
}
