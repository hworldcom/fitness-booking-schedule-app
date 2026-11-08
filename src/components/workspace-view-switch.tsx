"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  hasCoachWorkspace,
  resolveWorkspaceView,
  workspaceSwitchHref,
  type WorkspaceView,
} from "@/auth/workspace-view";

export function WorkspaceViewSwitch({
  actor,
  pathname,
  view,
}: {
  actor: ActorSnapshot;
  pathname: string;
  view: WorkspaceView;
}) {
  if (!hasCoachWorkspace(actor)) return null;
  const target =
    resolveWorkspaceView(actor, pathname, view) === "coach"
      ? "athlete"
      : "coach";
  return (
    <div className="workspace-view-switch">
      <hr />
      <Link
        href={workspaceSwitchHref(actor, pathname, target)}
        className="nav-item workspace-view-switch-link"
      >
        <ArrowLeftRight size={22} strokeWidth={1.7} aria-hidden="true" />
        <span>Switch to {target} view</span>
      </Link>
    </div>
  );
}
