"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActor } from "@/auth/client/actor-provider";
import {
  calendarPeriod,
  type TrainingCommand,
  type TrainingPage,
  type TrainingResult,
} from "@/training/contracts";

export function useTrainingWorkspace({
  initial,
  scope,
  date,
  view,
  timezone,
}: {
  initial: TrainingPage;
  scope: string;
  date: string;
  view: "week" | "month";
  timezone: string;
}) {
  const { actor } = useActor();
  const router = useRouter();
  const liveScope =
    actor.status === "authorized"
      ? `${actor.demoRun.slug}:${actor.profile.slug}`
      : "";
  const latestScope = useRef(liveScope);
  useEffect(() => {
    latestScope.current = liveScope;
  }, [liveScope]);
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<TrainingCommand | null>(null);
  const period = calendarPeriod(date, view);

  async function request(command: TrainingCommand): Promise<TrainingResult> {
    const response = await fetch("/api/training", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, scope }),
    });
    const result: TrainingResult = await response.json();
    if (
      latestScope.current !== scope ||
      (result.status === "ready" && result.scope !== scope)
    )
      throw Error("Account changed. Reload this page.");
    if (result.status !== "ready")
      throw Object.assign(
        Error(
          result.status === "conflict"
            ? "This training changed. Refresh before editing again."
            : result.status === "invalid"
              ? "Check the date, time and fields. Attendance is available after training ends. Daylight-saving gaps and repeated times need another time."
              : "Your training is unavailable. Please try again.",
        ),
        { definite: result.status !== "unavailable" },
      );
    return result;
  }
  async function load(append = false) {
    const result = await request({
      action: "list",
      args: {
        from: period.from,
        through: period.through,
        timezone,
        offset: append ? (page.next ?? 0) : 0,
      },
    });
    if (result.status === "ready" && "items" in result.value) {
      const next = result.value;
      setPage((previous) => ({
        ...next,
        items: append
          ? [
              ...previous.items,
              ...next.items.filter(
                (i) => !previous.items.some((p) => p.key === i.key),
              ),
            ]
          : next.items,
      }));
      if (!pending) setError("");
    }
  }
  async function save(command: TrainingCommand, onSaved?: () => void) {
    if (busy || latestScope.current !== scope) return;
    if (pending && JSON.stringify(pending) !== JSON.stringify(command)) {
      setError("A previous save needs retry before making another change.");
      return;
    }
    setPending(command);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(command);
      setPending(null);
      setMessage("Training saved.");
      onSaved?.();
      await load();
    } catch (e) {
      if ((e as Error & { definite?: boolean }).definite) setPending(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function refresh() {
    if (busy || pending) return;
    router.refresh();
    setBusy(true);
    void load()
      .catch(() => setError("Calendar unavailable. Try again."))
      .finally(() => setBusy(false));
  }
  function loadMore() {
    if (busy) return;
    setBusy(true);
    void load(true)
      .catch(() => setError("Could not load more training. Try again."))
      .finally(() => setBusy(false));
  }
  return {
    page,
    busy,
    error,
    message,
    pending,
    visible: liveScope === scope,
    save,
    refresh,
    loadMore,
    reportError: setError,
  };
}

export type TrainingWorkspace = ReturnType<typeof useTrainingWorkspace>;
