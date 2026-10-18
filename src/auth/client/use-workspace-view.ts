"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ActorSnapshot } from "../actor-contracts";
import {
  resolveWorkspaceView,
  workspaceViewForPath,
  workspaceViewStorageKey,
} from "../workspace-view";

const changed = "movx-workspace-view-changed";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changed, listener);
  };
}
function serverPreference() {
  return null;
}

// This preference changes navigation only. The server still authorizes every route.
export function useWorkspaceView(actor: ActorSnapshot, pathname: string) {
  const key = workspaceViewStorageKey(actor);
  const readPreference = useCallback(() => {
    try {
      return key ? window.sessionStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }, [key]);
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    serverPreference,
  );
  const routeView = workspaceViewForPath(pathname);
  useEffect(() => {
    if (!key || !routeView) return;
    try {
      if (window.sessionStorage.getItem(key) === routeView) return;
      window.sessionStorage.setItem(key, routeView);
      window.dispatchEvent(new Event(changed));
    } catch {
      // Explicit workspace routes remain usable when browser storage is disabled.
    }
  }, [key, routeView]);
  return resolveWorkspaceView(actor, pathname, preference);
}
