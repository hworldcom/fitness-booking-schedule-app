"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAthleteCoachesAction } from "@/app/my-coaches/actions";
import {
  loadConnectionHistoryAction,
  mutateConnectionAction,
  type ConnectionActionState,
} from "@/app/connections/actions";
import {
  mergeAthleteCoaches,
  isAthleteCoachFilter,
  type AthleteCoach,
  type AthleteCoachFilter,
  type AthleteCoachPage,
} from "@/domain/athlete-coaches";
import { myCoachesHref } from "@/domain/my-coaches-navigation";
import type {
  ConnectionHistoryReference,
  ConnectionPage,
} from "@/domain/coach-athlete-connections";
import { useRefreshOnReturn } from "@/components/use-refresh-on-return";
import { useConnectionRequestCount } from "./connection-request-count";
import { useMyCoachesAccess, useMyCoachesBusy } from "./my-coaches-workspace";
import { AthleteCoachRosterList } from "./athlete-coach-roster-list";
import { ConnectionHistory } from "./connection-history";
import {
  connectionReadMessage,
  freshConnectionRange,
} from "./connection-model";
import "@/features/coaches/athlete-roster.css";
import "./athlete-coach-roster.css";

const idle: ConnectionActionState = {
  status: "idle",
  message: "",
  connection: null,
};
type History = {
  attemptId: string;
  page: ConnectionPage<ConnectionHistoryReference> | null;
  message: string | null;
};
export function AthleteCoachRoster({
  scope,
  filter,
  initialPage,
}: {
  scope: string;
  filter: AthleteCoachFilter;
  initialPage: AthleteCoachPage | null;
}) {
  const router = useRouter();
  const access = useMyCoachesAccess(),
    setWorkspaceBusy = useMyCoachesBusy();
  const { refresh: refreshCount } = useConnectionRequestCount();
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false);
  const [error, setError] = useState(
    initialPage ? "" : "Coaches could not be loaded.",
  );
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<History | null>(null);
  const [pendingCommand, setPendingCommand] = useState<
    readonly [string, string][] | null
  >(null);
  const lock = useRef(false),
    alive = useRef(true),
    epoch = useRef(0),
    root = useRef<HTMLDivElement>(null);
  const blocked = busy || !!pendingCommand || !access;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    epoch.current++;
  }, [access]);
  useEffect(() => {
    setWorkspaceBusy(blocked);
    return () => setWorkspaceBusy(false);
  }, [blocked, setWorkspaceBusy]);
  useEffect(() => {
    if (!pendingCommand) return;
    const leave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [pendingCommand]);
  const valid = (generation: number) =>
    alive.current && generation === epoch.current;
  async function read(append: boolean, generation: number) {
    const target = append ? 0 : Math.max(20, page?.items.length ?? 20);
    let cursor = append ? (page?.nextCursor ?? null) : null;
    if (append && !cursor) return;
    let rows: AthleteCoach[] = [];
    do {
      const result = await loadAthleteCoachesAction(scope, filter, cursor);
      if (!valid(generation)) return;
      if (result.status !== "ready") {
        if (["signed-out", "forbidden", "preview"].includes(result.status)) {
          setDenied(true);
          setPage(null);
          setPendingCommand(null);
          setHistory(null);
        }
        setError(
          "Coaches could not be refreshed. Previously verified rows are kept when access is still valid.",
        );
        return;
      }
      rows = mergeAthleteCoaches(rows, result.page.items);
      cursor = result.page.nextCursor;
    } while (!append && cursor && rows.length < target);
    if (!valid(generation)) return;
    setPage({
      items: append ? mergeAthleteCoaches(page?.items ?? [], rows) : rows,
      nextCursor: cursor,
    });
    setHistory(null);
    setError("");
  }
  async function refresh(append = false) {
    if (lock.current || pendingCommand || !access || denied) return;
    lock.current = true;
    setBusy(true);
    const generation = epoch.current;
    try {
      await read(append, generation);
    } catch {
      if (valid(generation))
        setError("Coaches could not be refreshed. Try again.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useRefreshOnReturn(
    () => {
      if (
        !root.current?.querySelector(
          "details[open], .coach-connection-confirmation",
        )
      )
        void refresh();
    },
    !!page && !blocked && !denied && !error,
  );
  async function mutate(entries: readonly [string, string][]) {
    if (lock.current || !access || denied) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setPendingCommand(entries);
    const generation = epoch.current,
      form = new FormData();
    for (const [key, value] of entries) form.set(key, value);
    try {
      const result = await mutateConnectionAction(idle, form);
      if (!valid(generation)) return;
      if (result.status === "unavailable")
        setError(
          "The outcome is unverified. Retry this same connection action.",
        );
      else {
        setPendingCommand(null);
        refreshCount();
        if (result.status === "saved") {
          setNotice(result.message);
          try {
            await read(false, generation);
          } catch {
            if (valid(generation))
              setError(
                "Connection saved, but coaches could not be refreshed. Try again.",
              );
          }
        } else {
          setError(result.message);
          if (["signed-out", "forbidden"].includes(result.status)) {
            setDenied(true);
            setPage(null);
            setHistory(null);
          }
        }
      }
    } catch {
      if (valid(generation))
        setError(
          "The outcome is unverified. Retry this same connection action.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function connect(coach: AthleteCoach) {
    if (blocked || !coach.canSend || !coach.bookingId) return;
    void mutate([
      ["intent", "send"],
      ["ownerScope", scope],
      ["bookingId", coach.bookingId],
      ["operationId", crypto.randomUUID()],
      ...(coach.connection
        ? [["previousId", coach.connection.id] as [string, string]]
        : []),
    ]);
  }
  function disconnect(coach: AthleteCoach) {
    if (blocked || !coach.connection?.canDisconnect) return;
    void mutate([
      ["intent", "disconnect"],
      ["ownerScope", scope],
      ["connectionId", coach.connection.id],
    ]);
  }
  async function loadHistory(coach: AthleteCoach, more = false) {
    if (lock.current || blocked || !coach.connection?.canDisconnect) return;
    const connection = coach.connection,
      generation = epoch.current;
    lock.current = true;
    setBusy(true);
    try {
      const current =
        more && history?.attemptId === connection.id ? history.page : null;
      const next = await freshConnectionRange(
        (current?.items.length ?? 0) + 20,
        (cursor) => loadConnectionHistoryAction(connection.pairId, cursor),
      );
      if (!valid(generation)) return;
      if (next.status === "ready")
        setHistory({
          attemptId: connection.id,
          page: next.value,
          message: null,
        });
      else if (["conflict", "signed-out", "forbidden"].includes(next.status)) {
        setHistory(null);
        await read(false, generation);
        if (valid(generation)) setError(connectionReadMessage(next.status));
      } else
        setHistory({
          attemptId: connection.id,
          page: current,
          message: connectionReadMessage(next.status),
        });
    } catch {
      if (valid(generation))
        setHistory({
          attemptId: connection.id,
          page: null,
          message: "Shared history could not be loaded. Try again.",
        });
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (denied)
    return (
      <section className="availability-notice" role="alert">
        <p>
          Your account or workspace changed. Coach records have been cleared.
        </p>
        <Link href="/my-coaches" className="button secondary">
          Check account
        </Link>
      </section>
    );
  return (
    <div
      ref={root}
      className="coach-athlete-roster athlete-coach-roster"
      aria-busy={busy}
    >
      {notice && (
        <p role="status" className="coach-athlete-roster-feedback">
          {notice}
        </p>
      )}
      {(error || (pendingCommand && !busy)) && (
        <p role="alert" className="coach-athlete-roster-feedback">
          {error ||
            "The outcome is unverified. Retry this same connection action."}{" "}
          <button
            type="button"
            className="button secondary"
            disabled={busy || !access}
            onClick={() =>
              pendingCommand ? void mutate(pendingCommand) : void refresh()
            }
          >
            {pendingCommand ? "Retry same connection action" : "Try again"}
          </button>
        </p>
      )}
      <div className="coach-athlete-roster-toolbar">
        <span role="status">
          {page
            ? `${page.items.length} coach${page.items.length === 1 ? "" : "es"}${page.nextCursor ? " shown" : ""}`
            : "Coaches unavailable"}
        </span>
        <label>
          Status{" "}
          <select
            aria-label="Coach status"
            value={filter}
            disabled={blocked}
            onChange={(event) => {
              if (isAthleteCoachFilter(event.target.value))
                router.push(myCoachesHref("connected", event.target.value));
            }}
          >
            <option value="all">All coaches</option>
            <option value="connected">Connected</option>
            <option value="unconnected">Not connected</option>
          </select>
        </label>
      </div>
      {page && (
        <AthleteCoachRosterList
          coaches={page.items}
          busy={blocked}
          onConnect={connect}
          onDisconnect={disconnect}
          onHistory={(coach) => void loadHistory(coach)}
          renderHistory={(coach) =>
            history &&
            history.attemptId === coach.connection?.id &&
            coach.connection.status === "accepted" ? (
              <div className="athlete-coach-history">
                <ConnectionHistory
                  role="athlete"
                  name={coach.name}
                  page={history.page}
                  message={history.message}
                  busy={blocked}
                  bookingIds={
                    new Set(
                      history.page?.items.flatMap((row) =>
                        row.bookingId ? [row.bookingId] : [],
                      ) ?? [],
                    )
                  }
                  onLoad={() => void loadHistory(coach, !!history.page)}
                />
              </div>
            ) : null
          }
        />
      )}
      {page?.nextCursor && (
        <button
          type="button"
          className="button secondary coach-athlete-roster-more"
          disabled={blocked}
          onClick={() => void refresh(true)}
        >
          {busy ? "Loading…" : "Load more coaches"}
        </button>
      )}
      {!!page?.items.length && (
        <p className="coach-athlete-roster-order">
          Most recent session or contact first
        </p>
      )}
    </div>
  );
}
