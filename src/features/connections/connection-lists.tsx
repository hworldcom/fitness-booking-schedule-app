"use client";

import Link from "next/link";
import { ConnectionAvatar } from "./connection-avatar";
import type {
  ConnectionDecision,
  ConnectionProjection,
  ConnectionSection,
  ConnectionRole,
} from "@/domain/coach-athlete-connections";
import {
  CONNECTION_SECTIONS,
  connectionStatusLabel,
  connectionPresentation,
  type ConnectionPages,
} from "./connection-model";
import { ConnectionDisconnectControl } from "./connection-disconnect-control";
import type { ReactNode } from "react";

const sectionLabels = {
  accepted: "My athletes",
  incoming: "Incoming connection requests",
  outgoing: "Outgoing connection requests",
  history: "Previous connection requests",
};
const sectionEmpty = {
  accepted:
    "No connected athletes yet. Open Connection options on a shared session to send a request.",
  incoming: "No incoming connection requests.",
  outgoing: "No outgoing connection requests.",
  history: "No previous connection requests.",
};

export function ConnectionLists({
  role = "coach",
  pages,
  busy,
  mayInitiate,
  onRefresh,
  onPage,
  onDecision,
  onHistory,
  renderHistory,
}: {
  role?: ConnectionRole;
  pages: ConnectionPages;
  busy: boolean;
  mayInitiate: boolean;
  onRefresh: () => void;
  onPage: (section: ConnectionSection) => void;
  onDecision: (row: ConnectionProjection, intent: ConnectionDecision) => void;
  onHistory: (row: ConnectionProjection) => void;
  renderHistory: (row: ConnectionProjection) => ReactNode;
}) {
  const noun = role === "coach" ? "athletes" : "coaches";
  const title = role === "coach" ? "My athletes" : "My coaches";
  const target = role === "coach" ? "my-athletes" : "my-coaches";
  const labels = { ...sectionLabels, accepted: title };
  const empty = {
    ...sectionEmpty,
    accepted: `No connected ${noun} yet. Open Connection options on a shared session to send a request.`,
  };
  const name = (row: ConnectionProjection) =>
    connectionPresentation(row, role).name;
  return (
    <section
      className="coach-connections"
      id={target}
      aria-labelledby={`${target}-heading`}
    >
      <header className="coach-connections-heading">
        <div>
          <span className="eyebrow">YOUR CONNECTIONS</span>
          <h2 id={`${target}-heading`}>{title}</h2>
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
      {CONNECTION_SECTIONS.map((section) => {
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
                    id={`${role}-connection-${row.id}`}
                    tabIndex={-1}
                    aria-label={`${name(row)} · ${connectionStatusLabel(row.status)}`}
                  >
                    <header>
                      <ConnectionAvatar
                        name={name(row)}
                        imageUrl={connectionPresentation(row, role).imageUrl}
                      />
                      <div>
                        <h4>{name(row)}</h4>
                        <span>{connectionStatusLabel(row.status)}</span>
                      </div>
                    </header>
                    {role === "athlete" &&
                      row.status === "accepted" &&
                      !row.coachPublic && (
                        <p>
                          This coach is not available for new session requests.
                        </p>
                      )}
                    <div className="coach-connection-actions">
                      {role === "athlete" &&
                        row.status === "accepted" &&
                        row.coachPublic && (
                          <Link
                            className="button secondary"
                            href={
                              connectionPresentation(row, role).profileHref!
                            }
                          >
                            View coach and request a session
                          </Link>
                        )}
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
                          name={name(row)}
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
                    ? noun
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
