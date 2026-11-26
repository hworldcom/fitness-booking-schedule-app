"use client";

import { useEffect, useRef } from "react";
import { subscribeToVisibleReturn } from "@/browser/visible-return";

/** Refresh read-only state when returning; callers fence drafts and writes. */
export function useRefreshOnReturn(refresh: () => void, enabled = true) {
  const current = useRef({ refresh, enabled });
  useEffect(() => {
    current.current = { refresh, enabled };
  }, [refresh, enabled]);
  useEffect(
    () =>
      subscribeToVisibleReturn(document, window, () => {
        if (current.current.enabled) current.current.refresh();
      }),
    [],
  );
}
