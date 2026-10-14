"use client";

import { ConnectionAvatar } from "./connection-avatar";
import type {
  ConnectionDecision,
  ConnectionProjection,
  ConnectionSection,
} from "@/domain/coach-athlete-connections";
import {
  COACH_CONNECTION_SECTIONS,
  connectionStatusLabel,
  type CoachConnectionPages,
} from "./coach-connections-model";
import { ConnectionDisconnectControl } from "./connection-disconnect-control";
import type { ReactNode } from "react";

const labels = {
  accepted: "My athletes",
  incoming: "Incoming connection requests",
  outgoing: "Outgoing connection requests",
  history: "Previous connection requests",
};
const empty = {
  accepted:
    "No connected athletes yet. Open Connection options on a shared session to send a request.",
  incoming: "No incoming connection requests.",
  outgoing: "No outgoing connection requests.",
  history: "No previous connection requests.",
};

export function CoachAthleteConnections({
  pages,
  busy,
  mayInitiate,
  onRefresh,
  onPage,
  onDecision,
  onHistory,
  renderHistory,
}: {
  pages: CoachConnectionPages;
  busy: boolean;
  mayInitiate: boolean;
  onRefresh: () => void;
  onPage: (section: ConnectionSection) => void;
  onDecision: (row: ConnectionProjection, intent: ConnectionDecision) => void;
  onHistory: (row: ConnectionProjection) => void;
  renderHistory: (row: ConnectionProjection) => ReactNode;
}) {
  return (
    <section
      className="coach-connections"
      id="my-athletes"
      aria-labelledby="my-athletes-heading"
    >
      <header className="coach-connections-heading">
        <div>
          <span className="eyebrow">YOUR CONNECTIONS</span>
          <h2 id="my-athletes-heading">My athletes</h2>
          <p>
            Connections need both people to accept. Booking a session does not
            connect you automatically.
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onRefresh}
        >
          Refresh connections
        </button>
      </header>
      {COACH_CONNECTION_SECTIONS.map((section) => {
        const page = pages[section];
        return (
          <section
            className="coach-connection-section"
            key={section}
            aria-label={labels[section]}
          >
            {section !== "accepted" && <h3>{labels[section]}</h3>}
            {page && page.items.length > 0 && (
              <p className="coach-connection-count" aria-live="polite">
                {page.items.length} shown
                {page.nextCursor ? " · More available" : ""}
              </p>
            )}
            {!page ? (
              <div className="coach-connection-empty" role="alert">
                <p>
                  {busy
                    ? `Verifying ${labels[section].toLowerCase()}…`
                    : `${labels[section]} could not be verified. No connection data is shown.`}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onPage(section)}
                >
                  Retry {labels[section].toLowerCase()}
                </button>
              </div>
            ) : page.items.length === 0 ? (
              <p className="coach-connection-empty">{empty[section]}</p>
            ) : (
              <div className="coach-connection-grid">
                {page.items.map((row) => (
                  <article
                    className="coach-connection-card"
                    key={row.id}
                    data-connection-id={row.id}
                    data-pair-id={row.pairId}
                    id={`coach-connection-${row.id}`}
                    tabIndex={-1}
                    aria-label={`${row.athleteDisplayName} · ${connectionStatusLabel(row.status)}`}
                  >
                    <header>
                      <ConnectionAvatar
                        name={row.athleteDisplayName}
                        imageUrl={
                          row.status === "accepted"
                            ? row.athleteAvatarUrl
                            : null
                        }
                      />
                      <div>
                        <h4>{row.athleteDisplayName}</h4>
                        <span>{connectionStatusLabel(row.status)}</span>
                      </div>
                    </header>
                    <div className="coach-connection-actions">
                      {mayInitiate && row.canAccept && (
                        <button
                          type="button"
                          className="button dark"
                          disabled={busy}
                          onClick={() => onDecision(row, "accept")}
                        >
                          Accept connection
                        </button>
                      )}
                      {row.canDecline && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => onDecision(row, "decline")}
                        >
                          Decline connection
                        </button>
                      )}
                      {row.canWithdraw && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => onDecision(row, "withdraw")}
                        >
                          Withdraw request
                        </button>
                      )}
                      {row.status === "accepted" && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => onHistory(row)}
                        >
                          View shared history
                        </button>
                      )}
                      {row.canDisconnect && (
                        <ConnectionDisconnectControl
                          name={row.athleteDisplayName}
                          disabled={busy}
                          onDisconnect={() => onDecision(row, "disconnect")}
                        />
                      )}
                    </div>
                    {section === "incoming" && !row.canAccept && (
                      <p>
                        This request currently cannot be accepted. You can still
                        decline it.
                      </p>
                    )}
                    {row.status === "accepted" && renderHistory(row)}
                  </article>
                ))}
              </div>
            )}
            {page?.nextCursor && (
              <div className="coach-connection-pagination">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onPage(section)}
                >
                  Load more{" "}
                  {section === "accepted"
                    ? "athletes"
                    : section === "history"
                      ? "previous connections"
                      : section + " requests"}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
