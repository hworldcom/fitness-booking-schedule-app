"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CalendarResult } from "@/calendar/connection";
import {
  isCalendarExportResult,
  type CalendarExportCommand,
  type CalendarExportResult,
} from "@/calendar/export";

async function requestExport(
  input: CalendarExportCommand | undefined,
  signal: AbortSignal,
): Promise<CalendarExportResult> {
  try {
    const response = await fetch("/api/account/google-calendar/export", {
      method: input ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: input ? { "content-type": "application/json" } : {},
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    const value: unknown = await response.json();
    return isCalendarExportResult(value) &&
      (response.ok || value.status !== "ready")
      ? value
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
export function GoogleCalendarExport({
  connection,
  onConnectionChanged,
}: {
  connection: CalendarResult | null;
  onConnectionChanged(): void;
}) {
  if (!connection || connection.status !== "ready") return null;
  return (
    <ExportControls
      key={connection.connection.generation + ":" + connection.connection.state}
      connection={connection}
      onConnectionChanged={onConnectionChanged}
    />
  );
}
function ExportControls({
  connection,
  onConnectionChanged,
}: {
  connection: Extract<CalendarResult, { status: "ready" }>;
  onConnectionChanged(): void;
}) {
  const [result, setResult] = useState<CalendarExportResult | null>(null),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [pending, setPending] = useState<CalendarExportCommand | null>(null);
  const alive = useRef(false),
    lock = useRef(false),
    mutation = useRef<AbortController | null>(null),
    read = useRef<AbortController | null>(null);
  const generation = connection.connection.generation;
  const connectionState = connection.connection.state;
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    read.current = controller;
    void requestExport(undefined, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setResult(value);
      if (
        value.status === "ready" &&
        (value.generation !== generation ||
          value.connectionState !== connectionState)
      )
        onConnectionChanged();
    });
    return () => {
      alive.current = false;
      controller.abort();
      mutation.current?.abort();
    };
  }, [reload, generation, connectionState, onConnectionChanged]);
  const polling =
    result?.status === "ready" &&
    result.available &&
    result.export.enabled &&
    (result.export.pending > 0 || result.export.backfillPending);
  useEffect(() => {
    if (!polling || busy) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !lock.current)
        setReload((n) => n + 1);
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [polling, busy, reload]);
  async function run(input: CalendarExportCommand) {
    if (lock.current) return;
    lock.current = true;
    read.current?.abort();
    setBusy(true);
    setPending(input);
    const controller = new AbortController();
    mutation.current = controller;
    const value = await requestExport(input, controller.signal);
    if (alive.current && !controller.signal.aborted) {
      setResult(value);
      setBusy(false);
      if (value.status !== "unavailable") setPending(null);
      if (
        value.status === "ready" &&
        (value.generation !== generation ||
          value.connectionState !== connectionState)
      )
        onConnectionChanged();
    }
    lock.current = false;
  }
  function command(action: CalendarExportCommand["action"]) {
    if (result?.status !== "ready") return;
    void run({
      action,
      version: result.export.version,
      generation: result.generation,
      commandId: crypto.randomUUID(),
      ...(action === "repair" ? { acknowledged: true as const } : {}),
    });
  }
  return (
    <GoogleCalendarExportView
      result={result}
      busy={busy}
      pending={pending !== null}
      onCommand={command}
      onReload={() => {
        setResult(null);
        setReload((n) => n + 1);
      }}
      onRetry={() => {
        if (pending) void run(pending);
      }}
    />
  );
}
const issueText: Record<string, string> = {
  transient: "Google is temporarily unavailable. Delivery will retry.",
  "authorization-required":
    "Renew your Google Calendar connection to resume delivery.",
  "calendar-missing":
    "Recover the dedicated calendar using the connection controls above.",
  "event-missing": "A previously exported booking copy is missing in Google.",
  "ownership-conflict":
    "A copy cannot be safely updated. Check for Google-side changes, including added guests, then retry. MovX leaves that copy unchanged.",
  "outcome-unknown":
    "An earlier Google request has an unknown outcome. A retry checks the same copy instead of creating another.",
  "retry-exhausted":
    "Automatic retries have stopped. Check the connection and retry delivery.",
};
export function GoogleCalendarExportView({
  result,
  busy = false,
  pending = false,
  onCommand,
  onReload,
  onRetry,
}: {
  result: CalendarExportResult | null;
  busy?: boolean;
  pending?: boolean;
  onCommand(action: CalendarExportCommand["action"]): void;
  onReload(): void;
  onRetry(): void;
}) {
  const [repair, setRepair] = useState(false);
  return (
    <section
      aria-label="Google booking sync"
      className="calendar-connection calendar-export"
    >
      <h3>Booking sync</h3>
      <p>
        Choose once for your account. When enabled, upcoming confirmed bookings
        are added to your dedicated Google calendar. Later confirmations,
        rescheduling and final cancellations update your copies automatically.
        Each participant controls their own copies.
      </p>
      <p>
        Copies contain a generic session title, booked times, your permitted
        location and a MovX link. No guests, participant contacts or private
        notes are included.{" "}
        <Link href="/privacy#privacy-google-calendar">
          Booking sync privacy details
        </Link>
      </p>
      {result === null ? (
        <p role="status">Loading booking sync…</p>
      ) : result.status !== "ready" ? (
        <>
          <p role="status">
            {result.status === "conflict"
              ? "Booking sync changed. Reload its status before trying again."
              : result.status === "connection-required"
                ? "Connect or renew Google Calendar, then reload booking sync."
                : pending
                  ? "The previous request could not be verified. Reload status or retry that same request."
                  : "Booking sync is unavailable. Reload its status to try again."}
          </p>
          {pending && (
            <button
              type="button"
              className="button light"
              disabled={busy}
              onClick={onRetry}
            >
              Retry previous sync request
            </button>
          )}
        </>
      ) : (
        <>
          <label className="calendar-connection-confirm">
            <input
              type="checkbox"
              checked={result.export.enabled}
              disabled={
                busy ||
                (!result.export.enabled &&
                  (!result.available || result.connectionState !== "connected"))
              }
              onChange={(e) =>
                onCommand(e.target.checked ? "enable" : "disable")
              }
            />
            Sync confirmed bookings
          </label>
          <p role="status">
            {busy
              ? "Updating booking sync…"
              : !result.export.enabled
                ? "Booking sync is off. Existing Google copies remain."
                : !result.available
                  ? "Booking sync is paused because delivery is unavailable. You can still turn it off."
                  : result.connectionState !== "connected"
                    ? "Booking sync is paused. Restore your Calendar connection to continue."
                    : result.export.backfillPending
                      ? "Finding upcoming confirmed bookings…"
                      : result.export.failed > 0
                        ? "Some booking copies need attention."
                        : result.export.pending > 0
                          ? "Booking updates are waiting for delivery."
                          : "No pending booking updates."}
          </p>
          {result.export.enabled && (
            <p>
              {result.export.backfillPending &&
              result.export.pending === 0 &&
              result.export.failed === 0
                ? "Update counts will be available after preparation."
                : `${result.export.pending} pending updates · ${result.export.failed} need attention${result.export.backfillPending ? " · Finding more bookings…" : ""}`}
            </p>
          )}
          {result.export.lastSyncedAt && (
            <p>
              Last synced:{" "}
              {new Date(result.export.lastSyncedAt).toLocaleString("en-GB", {
                timeZone: "Europe/Berlin",
              })}{" "}
              (Europe/Berlin)
            </p>
          )}
          {result.export.enabled &&
            result.export.issues.map((issue) => (
              <p key={issue}>{issueText[issue]}</p>
            ))}
          {result.export.enabled && result.export.failed > 0 && (
            <button
              type="button"
              className="button light"
              disabled={
                busy ||
                !result.available ||
                result.connectionState !== "connected"
              }
              onClick={() => onCommand("retry")}
            >
              Retry booking delivery
            </button>
          )}
          {result.export.enabled && result.export.missing > 0 && (
            <details>
              <summary>Repair missing booking copies</summary>
              <p>
                Check your Google calendar first. This recreates missing copies
                for bookings you can currently access. An earlier copy may
                remain if a Google result was delayed. Your MovX bookings stay
                unchanged.
              </p>
              <label className="calendar-connection-confirm">
                <input
                  type="checkbox"
                  checked={repair}
                  disabled={busy}
                  onChange={(e) => setRepair(e.target.checked)}
                />
                I checked Google Calendar and want to recreate missing booking
                copies.
              </label>
              <button
                type="button"
                className="button light"
                disabled={
                  busy ||
                  !repair ||
                  !result.available ||
                  result.connectionState !== "connected"
                }
                onClick={() => {
                  setRepair(false);
                  onCommand("repair");
                }}
              >
                Recreate missing booking copies
              </button>
            </details>
          )}
          <p>
            Turning sync off keeps Google connected and leaves existing copies,
            including past sessions, in Google. Already-sent requests may
            finish. Disconnecting resets booking sync to off.
          </p>
        </>
      )}
      <button
        type="button"
        className="button light"
        disabled={busy}
        onClick={onReload}
      >
        Reload booking sync
      </button>
    </section>
  );
}
