"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { loadCoachAthletesAction } from "@/app/coach/athletes/actions";
import {
  mutateConnectionAction,
  type ConnectionActionState,
} from "@/app/connections/actions";
import type { ConnectionDecision } from "@/domain/coach-athlete-connections";
import {
  mergeCoachAthletes,
  type CoachAthlete,
  type CoachAthleteFilter,
  type CoachAthletePage,
} from "@/domain/coach-athletes";
import { useRefreshOnReturn } from "@/components/use-refresh-on-return";
import { ClientForm } from "@/features/external-clients/client-form";
import { useConnectionRequestCount } from "@/features/connections/connection-request-count";
import { CoachAthletesWorkspace } from "./coach-athletes-workspace";
import { CoachAthleteRosterList } from "./athlete-roster-list";
import "./athlete-roster.css";
import "@/features/session-types/session-types.css";

const idle: ConnectionActionState = {
  status: "idle",
  message: "",
  connection: null,
};
export function CoachAthleteRoster({
  scope,
  filter,
  initialPage,
  mayInitiate,
  initialAdd = false,
}: {
  scope: string;
  filter: CoachAthleteFilter;
  initialPage: CoachAthletePage | null;
  mayInitiate: boolean;
  initialAdd?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(initialAdd && mayInitiate);
  const [blocked, setBlocked] = useState(false);
  return (
    <CoachAthletesWorkspace
      active="connected"
      navigationDisabled={blocked}
      headingActions={
        mayInitiate && (
          <button
            type="button"
            className="button dark"
            disabled={blocked}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Add athlete
          </button>
        )
      }
    >
      <RosterBody
        scope={scope}
        filter={filter}
        initialPage={initialPage}
        mayInitiate={mayInitiate}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        onBlockedChange={setBlocked}
      />
    </CoachAthletesWorkspace>
  );
}
function RosterBody({
  scope,
  filter,
  initialPage,
  mayInitiate,
  addOpen,
  setAddOpen,
  onBlockedChange,
}: {
  scope: string;
  filter: CoachAthleteFilter;
  initialPage: CoachAthletePage | null;
  mayInitiate: boolean;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const router = useRouter();
  const { refresh: refreshCount } = useConnectionRequestCount();
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialPage ? "" : "Athletes could not be loaded.",
  );
  const [notice, setNotice] = useState("");
  const [savedHref, setSavedHref] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<
    readonly [string, string][] | null
  >(null);
  const [contactPending, setContactPending] = useState(false);
  const [contactDirty, setContactDirty] = useState(false);
  const lock = useRef(false),
    alive = useRef(true),
    root = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const blocked = busy || !!pendingCommand || contactPending;
  const pendingChanged = useCallback(
    (value: boolean) => setContactPending(value),
    [],
  );
  const dirtyChanged = useCallback(
    (value: boolean) => setContactDirty(value),
    [],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onBlockedChange(blocked || addOpen);
  }, [blocked, addOpen, onBlockedChange]);
  useEffect(() => () => onBlockedChange(false), [onBlockedChange]);
  useEffect(() => {
    if (!addOpen) return;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLInputElement>('input[name="name"], input')
      ?.focus();
  }, [addOpen]);
  useEffect(() => {
    if (!contactDirty && !contactPending && !pendingCommand) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [contactDirty, contactPending, pendingCommand]);
  async function read(append = false) {
    const target = append ? 0 : Math.max(20, page?.items.length ?? 20);
    let cursor = append ? (page?.nextCursor ?? null) : null;
    if (append && !cursor) return;
    let rows: CoachAthlete[] = [];
    do {
      const result = await loadCoachAthletesAction(scope, filter, cursor);
      if (!alive.current) return;
      if (result.status !== "ready") {
        if (["signed-out", "forbidden", "preview"].includes(result.status)) {
          setDenied(true);
          setPage(null);
          setPendingCommand(null);
        }
        setError(
          "Athletes could not be refreshed. Previously verified rows are kept when access is still valid.",
        );
        return;
      }
      rows = mergeCoachAthletes(rows, result.page.items);
      cursor = result.page.nextCursor;
    } while (!append && cursor && rows.length < target);
    if (!alive.current) return;
    setPage({
      items: append ? mergeCoachAthletes(page?.items ?? [], rows) : rows,
      nextCursor: cursor,
    });
    setError("");
  }
  async function refresh(append = false, afterContactSave = false) {
    if (lock.current || pendingCommand || (addOpen && !afterContactSave))
      return;
    lock.current = true;
    setBusy(true);
    try {
      await read(append);
    } catch {
      if (alive.current)
        setError("Athletes could not be refreshed. Try again.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useRefreshOnReturn(
    () => {
      if (
        root.current?.querySelector(
          "details[open], .coach-connection-confirmation",
        )
      )
        return;
      void refresh();
    },
    !!page && !blocked && !addOpen && !denied && !error,
  );
  async function mutate(entries: readonly [string, string][]) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setSavedHref(null);
    setPendingCommand(entries);
    const form = new FormData();
    for (const [key, value] of entries) form.set(key, value);
    let result: ConnectionActionState;
    try {
      result = await mutateConnectionAction(idle, form);
    } catch {
      if (alive.current) {
        setError(
          "The outcome is unverified. Retry this same connection action.",
        );
        setBusy(false);
      }
      lock.current = false;
      return;
    }
    if (!alive.current) {
      lock.current = false;
      return;
    }
    if (result.status === "unavailable")
      setError("The outcome is unverified. Retry this same connection action.");
    else {
      setPendingCommand(null);
      refreshCount();
      if (result.status === "saved") {
        setNotice(result.message);
        try {
          await read();
        } catch {
          if (alive.current)
            setError(
              "Connection saved, but athletes could not be refreshed. Try again.",
            );
        }
      } else {
        setError(result.message);
        if (["signed-out", "forbidden"].includes(result.status)) {
          setDenied(true);
          setPage(null);
        }
      }
    }
    lock.current = false;
    if (alive.current) setBusy(false);
  }
  function connect(athlete: CoachAthlete) {
    if (blocked || !mayInitiate || !athlete.canSend || !athlete.bookingId)
      return;
    void mutate([
      ["intent", "send"],
      ["ownerScope", scope],
      ["bookingId", athlete.bookingId],
      ["operationId", crypto.randomUUID()],
      ...(athlete.connection
        ? [["previousId", athlete.connection.id] as [string, string]]
        : []),
    ]);
  }
  function decide(athlete: CoachAthlete, intent: ConnectionDecision) {
    if (blocked || !athlete.connection) return;
    void mutate([
      ["intent", intent],
      ["ownerScope", scope],
      ["connectionId", athlete.connection.id],
    ]);
  }
  function closeAdd() {
    if (contactPending) return;
    if (contactDirty && !confirm("Discard this unsaved athlete?")) return;
    dialog.current?.close();
    setAddOpen(false);
    setContactDirty(false);
    onBlockedChange(false);
    requestAnimationFrame(() =>
      root.current
        ?.closest(".coach-workspace")
        ?.querySelector<HTMLButtonElement>(
          ".coach-workspace-header-actions button",
        )
        ?.focus(),
    );
  }
  if (denied)
    return (
      <section className="availability-notice" role="alert">
        <p>
          Your account or coach access changed. Athlete records have been
          cleared.
        </p>
        <Link href="/coach/athletes" className="button secondary">
          Check account
        </Link>
      </section>
    );
  return (
    <div ref={root} className="coach-athlete-roster" aria-busy={busy}>
      {(notice || savedHref) && (
        <p role="status" className="coach-athlete-roster-feedback">
          {notice}
          {savedHref && (
            <>
              {" "}
              <Link href={savedHref}>View athlete</Link>
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="coach-athlete-roster-feedback">
          {error}{" "}
          <button
            type="button"
            className="button secondary"
            disabled={busy || contactPending}
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
            ? `${page.items.length} athlete${page.items.length === 1 ? "" : "s"}${page.nextCursor ? " shown" : ""}`
            : "Athletes unavailable"}
        </span>
        <label>
          Status{" "}
          <select
            aria-label="Athlete status"
            value={filter}
            disabled={blocked || addOpen}
            onChange={(event) => {
              router.push(
                event.target.value === "all"
                  ? "/coach/athletes"
                  : `/coach/athletes?status=${event.target.value}`,
              );
            }}
          >
            <option value="all">All athletes</option>
            <option value="connected">Connected</option>
            <option value="unconnected">Not connected</option>
            <option value="external">External</option>
          </select>
        </label>
      </div>
      {page && (
        <CoachAthleteRosterList
          athletes={page.items}
          busy={blocked || addOpen}
          mayInitiate={mayInitiate}
          onConnect={connect}
          onDecision={decide}
        />
      )}
      {page?.nextCursor && (
        <button
          type="button"
          className="button secondary coach-athlete-roster-more"
          disabled={blocked || addOpen}
          onClick={() => void refresh(true)}
        >
          {busy ? "Loading…" : "Load more athletes"}
        </button>
      )}
      {page && page.items.length > 0 && (
        <p className="coach-athlete-roster-order">
          Most recent session or contact first
        </p>
      )}
      {addOpen && (
        <dialog
          ref={dialog}
          className="coach-athlete-create-dialog"
          aria-labelledby="coach-athlete-create-title"
          onCancel={(event) => {
            event.preventDefault();
            closeAdd();
          }}
          onClick={(event) => {
            if (event.target === dialog.current) closeAdd();
          }}
        >
          <header>
            <h2 id="coach-athlete-create-title">Add external athlete</h2>
            <button
              type="button"
              className="button secondary"
              aria-label="Close new athlete form"
              disabled={contactPending}
              onClick={closeAdd}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <ClientForm
            onPendingChange={pendingChanged}
            onDirtyChange={dirtyChanged}
            onSaved={(client) => {
              dialog.current?.close();
              setAddOpen(false);
              setContactDirty(false);
              setContactPending(false);
              setNotice("Athlete saved.");
              setSavedHref(`/coach/athletes/external/${client.id}`);
              requestAnimationFrame(() =>
                root.current
                  ?.querySelector<HTMLAnchorElement>(
                    ".coach-athlete-roster-feedback a",
                  )
                  ?.focus(),
              );
              if (filter !== "all") router.push("/coach/athletes");
              else void refresh(false, true);
            }}
          />
        </dialog>
      )}
    </div>
  );
}
