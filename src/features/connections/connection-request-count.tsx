"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { connectionCountIdentity } from "./connection-count-model";
import type { ConnectionRole } from "@/domain/coach-athlete-connections";

type Count =
  | { status: "loading" | "unavailable"; value?: never }
  | {
      status: "ready";
      value: number;
    };
const unavailable = { status: "unavailable" } as const;
const CountContext = createContext<{
  count: Count;
  refresh: () => void;
}>({ count: unavailable, refresh: () => {} });

export function ConnectionRequestCountProvider({
  role,
  viewKey,
  children,
}: {
  role: ConnectionRole;
  viewKey: string;
  children: ReactNode;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const identity = connectionCountIdentity(session, actor);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    count: Count;
  } | null>(null);
  const key = JSON.stringify([identity, role, viewKey, revision]);
  const refresh = useCallback(
    () => setRevision((value) => value + 1),
    [setRevision],
  );
  useEffect(() => {
    if (!identity) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void fetch(`/api/connections/pending-count?role=${role}`, {
      cache: "no-store",
      headers: { "X-MovX-Connection-Owner": identity },
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((response) => {
        if (active)
          setResult({
            key,
            count:
              response.status === "ready" &&
              Number.isSafeInteger(response.value) &&
              response.value >= 0
                ? { status: "ready", value: response.value }
                : unavailable,
          });
      })
      .catch(() => {
        if (active) setResult({ key, count: unavailable });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [identity, key, role]);
  const count: Count = !identity
    ? unavailable
    : result?.key === key
      ? result.count
      : { status: "loading" };
  return (
    <CountContext.Provider value={{ count, refresh }}>
      {children}
    </CountContext.Provider>
  );
}

export function useConnectionRequestCount() {
  return useContext(CountContext);
}

export function connectionRequestCountLabel(count: Count) {
  return count.status === "ready"
    ? `Connection requests, ${count.value} pending incoming`
    : count.status === "loading"
      ? "Connection requests, loading pending count"
      : "Connection requests, pending count unavailable";
}

export function ConnectionRequestCountBadge() {
  const { count } = useConnectionRequestCount();
  return (
    <span className="workspace-section-count" aria-hidden="true">
      {count.status === "ready"
        ? count.value
        : count.status === "loading"
          ? "…"
          : "—"}
    </span>
  );
}

export function ConnectionRequestCountRetry() {
  const { count, refresh } = useConnectionRequestCount();
  return count.status === "unavailable" ? (
    <button
      type="button"
      className="text-button connection-count-retry"
      onClick={refresh}
    >
      Retry pending count
    </button>
  ) : null;
}
