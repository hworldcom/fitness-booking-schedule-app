"use client";

import type {
  ConnectionHistoryReference,
  ConnectionPage,
} from "@/domain/coach-athlete-connections";
import {
  connectionHistoryStatus,
  connectionHistoryTime,
} from "./coach-connections-model";

export function CoachConnectionHistory({
  name,
  page,
  message,
  busy,
  bookingIds,
  onLoad,
}: {
  name: string;
  page: ConnectionPage<ConnectionHistoryReference> | null;
  message: string | null;
  busy: boolean;
  bookingIds: ReadonlySet<string>;
  onLoad: () => void;
}) {
  return (
    <section
      className="coach-connection-history"
      aria-label={`Shared history with ${name}`}
    >
      <h4>Shared history</h4>
      <p>
        Your shared booking requests and sessions stay here when you reconnect.
      </p>
      {message && <p role="alert">{message}</p>}
      {!page ? (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onLoad}
        >
          {busy ? "Loading history…" : "Retry shared history"}
        </button>
      ) : page.items.length === 0 ? (
        <p>No shared history is available.</p>
      ) : (
        <ul>
          {page.items.map((row) => (
            <li
              key={row.id}
              id={`shared-history-${row.id}`}
              tabIndex={-1}
              data-history-id={row.id}
              data-request-id={row.requestId ?? undefined}
              data-booking-id={row.bookingId ?? undefined}
            >
              <div>
                <strong>{connectionHistoryTime(row)}</strong>
                <span>
                  {row.trainingLocationName} · {row.publicLocationLabel}
                </span>
                <span>{connectionHistoryStatus(row)}</span>
              </div>
              {row.bookingId && bookingIds.has(row.bookingId) && (
                <a href={`#coach-booking-${row.bookingId}`}>View session</a>
              )}
            </li>
          ))}
        </ul>
      )}
      {page?.nextCursor && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onLoad}
        >
          {busy ? "Loading history…" : "Load older shared history"}
        </button>
      )}
    </section>
  );
}
