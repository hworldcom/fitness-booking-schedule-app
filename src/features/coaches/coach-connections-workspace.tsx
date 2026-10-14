"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadBookingConnectionContextAction,
  loadCoachConnectionPagesAction,
  loadConnectionHistoryAction,
  loadConnectionPageAction,
  mutateConnectionAction,
  type ConnectionActionState,
} from "@/app/connections/actions";
import type {
  BookingConnectionContext,
  ConnectionDecision,
  ConnectionHistoryReference,
  ConnectionPage,
  ConnectionProjection,
  ConnectionSection,
} from "@/domain/coach-athlete-connections";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import { CoachClientCards } from "./coach-client-cards";
import { BookingConnectionOptions } from "./booking-connection-options";
import { CoachAthleteConnections } from "./coach-athlete-connections";
import { CoachConnectionHistory } from "./coach-connection-history";
import {
  applyConnectionResult,
  connectionReadMessage,
  mergeConnectionRows,
  UNAVAILABLE_CONNECTION_PAGES,
  type CoachConnectionPages,
} from "./coach-connections-model";

const idle: ConnectionActionState = {
  status: "idle",
  message: "",
  connection: null,
};
type HistoryState = {
  source: string;
  attemptId: string;
  pairId: string;
  page: ConnectionPage<ConnectionHistoryReference> | null;
  message: string | null;
};
type ContextState = {
  source: string;
  entries: Readonly<
    Record<
      string,
      { value: BookingConnectionContext | null; message: string | null }
    >
  >;
};

export function CoachConnectionsWorkspace({
  bookings,
  referenceTime,
  initialPages,
  sourceVersion,
  mayInitiate,
}: {
  bookings: readonly PrivateBookingProjection[] | null;
  referenceTime: string;
  initialPages: CoachConnectionPages;
  sourceVersion: string;
  mayInitiate: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<{
    source: string;
    pages: CoachConnectionPages;
  } | null>(null);
  const [contexts, setContexts] = useState<ContextState | null>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [result, setResult] = useState<ConnectionActionState | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lock = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  // Revalidation includes a fresh RSC tree. Results from the preceding tree
  // cannot overwrite the new server authority or restore removed media/history.
  const pages = local?.source === sourceVersion ? local.pages : initialPages;
  const contextEntries =
    contexts?.source === sourceVersion ? contexts.entries : {};
  const visibleHistory =
    history?.source === sourceVersion &&
    pages.accepted?.items.some(
      (row) => row.id === history.attemptId && row.status === "accepted",
    )
      ? history
      : null;
  const busy = pending || busyKey !== null;
  const bookingIds = new Set(bookings?.map((row) => row.id));
  useEffect(() => {
    if (result) feedback.current?.focus();
  }, [result]);
  useEffect(() => {
    if (focusTarget)
      document.getElementById(focusTarget.id)?.focus({ preventScroll: true });
  }, [focusTarget]);

  function message(status: ConnectionActionState["status"], text: string) {
    setResult({ status, message: text, connection: null });
  }
  function run(key: string, work: () => Promise<void>) {
    if (lock.current || pending) return;
    lock.current = true;
    setBusyKey(key);
    startTransition(async () => {
      try {
        await work();
      } catch {
        message(
          "unavailable",
          "MovX could not verify that connection. Refresh its status before trying again.",
        );
      } finally {
        lock.current = false;
        setBusyKey(null);
      }
    });
  }
  async function refreshPages() {
    const next = await loadCoachConnectionPagesAction();
    setLocal({ source: sourceVersion, pages: next });
    return next;
  }
  function refresh() {
    run("refresh", async () => {
      setHistory(null);
      setContexts(null);
      setContextRevision((revision) => revision + 1);
      setLocal({ source: sourceVersion, pages: UNAVAILABLE_CONNECTION_PAGES });
      const next = await refreshPages();
      message(
        Object.values(next).every(Boolean) ? "saved" : "unavailable",
        Object.values(next).every(Boolean)
          ? "Connections updated."
          : "Some connections could not be verified. Retry the affected list.",
      );
    });
  }
  function mutate(form: FormData) {
    run("mutation", async () => {
      setHistory(null);
      if (form.get("intent") === "disconnect") {
        setLocal({
          source: sourceVersion,
          pages: { ...pages, accepted: null },
        });
      }
      const next = await mutateConnectionAction(idle, form);
      setResult(next);
      // An unavailable response may hide a committed operation. Preserve its
      // operation ID until a definitive result or an explicit context read.
      if (next.status !== "unavailable") {
        setContexts(null);
        setContextRevision((revision) => revision + 1);
      }
      if (next.status === "saved" && next.connection) {
        setLocal({
          source: sourceVersion,
          pages: applyConnectionResult(pages, next.connection),
        });
        await refreshPages();
      } else if (
        ["conflict", "signed-out", "forbidden"].includes(next.status)
      ) {
        setLocal({
          source: sourceVersion,
          pages: UNAVAILABLE_CONNECTION_PAGES,
        });
        await refreshPages();
        router.refresh();
      }
    });
  }
  function decide(row: ConnectionProjection, intent: ConnectionDecision) {
    const form = new FormData();
    form.set("intent", intent);
    form.set("connectionId", row.id);
    mutate(form);
  }
  function loadContext(booking: PrivateBookingProjection) {
    run(`context:${booking.id}`, async () => {
      const next = await loadBookingConnectionContextAction(booking.id);
      setContexts({
        source: sourceVersion,
        entries: {
          ...contextEntries,
          [booking.id]: {
            value: next.status === "ready" ? next.value : null,
            message:
              next.status === "ready"
                ? null
                : connectionReadMessage(next.status),
          },
        },
      });
    });
  }
  function loadPage(section: ConnectionSection) {
    run(`page:${section}`, async () => {
      const current = pages[section];
      if (section === "accepted") setHistory(null);
      setLocal({ source: sourceVersion, pages: { ...pages, [section]: null } });
      const next = await loadConnectionPageAction(
        "coach",
        section,
        current?.nextCursor ?? null,
      );
      if (next.status !== "ready") {
        setLocal({
          source: sourceVersion,
          pages: { ...pages, [section]: null },
        });
        if (section === "accepted") setHistory(null);
        message("unavailable", connectionReadMessage(next.status));
        return;
      }
      setLocal({
        source: sourceVersion,
        pages: {
          ...pages,
          [section]: {
            ...next.value,
            items: current
              ? mergeConnectionRows(current.items, next.value.items)
              : next.value.items,
          },
        },
      });
      const firstNew = next.value.items.find(
        (row) => !current?.items.some((item) => item.id === row.id),
      );
      if (firstNew) setFocusTarget({ id: `coach-connection-${firstNew.id}` });
    });
  }
  function loadHistory(row: ConnectionProjection, more = false) {
    run(`history:${row.id}`, async () => {
      const current =
        more && visibleHistory?.attemptId === row.id
          ? visibleHistory.page
          : null;
      setHistory({
        source: sourceVersion,
        attemptId: row.id,
        pairId: row.pairId,
        page: null,
        message: null,
      });
      const next = await loadConnectionHistoryAction(
        row.pairId,
        current?.nextCursor ?? null,
      );
      if (next.status !== "ready") {
        setHistory({
          source: sourceVersion,
          attemptId: row.id,
          pairId: row.pairId,
          page: null,
          message: connectionReadMessage(next.status),
        });
        if (["conflict", "signed-out", "forbidden"].includes(next.status)) {
          setHistory(null);
          message("conflict", connectionReadMessage(next.status));
          await refreshPages();
        }
        return;
      }
      setHistory({
        source: sourceVersion,
        attemptId: row.id,
        pairId: row.pairId,
        page: {
          ...next.value,
          items: current
            ? mergeConnectionRows(current.items, next.value.items)
            : next.value.items,
        },
        message: null,
      });
      const firstNew = next.value.items.find(
        (row) => !current?.items.some((item) => item.id === row.id),
      );
      if (firstNew) setFocusTarget({ id: `shared-history-${firstNew.id}` });
    });
  }
  return (
    <div className="coach-connections-workspace">
      {result && (
        <p
          ref={feedback}
          tabIndex={-1}
          className={`coach-connection-feedback ${result.status === "saved" ? "success" : "error"}`}
          role={result.status === "saved" ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
      <CoachClientCards
        bookings={bookings}
        referenceTime={referenceTime}
        renderConnection={(booking) => (
          <BookingConnectionOptions
            key={`${booking.id}:${booking.status}:${contextRevision}`}
            booking={booking}
            context={contextEntries[booking.id]?.value}
            error={contextEntries[booking.id]?.message ?? null}
            busy={busy}
            mayInitiate={mayInitiate}
            onLoad={() => loadContext(booking)}
            onMutation={mutate}
          />
        )}
      />
      <CoachAthleteConnections
        pages={pages}
        busy={busy}
        mayInitiate={mayInitiate}
        onRefresh={refresh}
        onPage={loadPage}
        onDecision={decide}
        onHistory={(row) => loadHistory(row)}
        renderHistory={(row) =>
          visibleHistory?.attemptId === row.id ? (
            <CoachConnectionHistory
              name={row.athleteDisplayName}
              page={visibleHistory.page}
              message={visibleHistory.message}
              busy={busy}
              bookingIds={bookingIds}
              onLoad={() => loadHistory(row, Boolean(visibleHistory.page))}
            />
          ) : null
        }
      />
    </div>
  );
}
