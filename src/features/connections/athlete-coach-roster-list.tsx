"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, MoreHorizontal, UserPlus } from "lucide-react";
import {
  athleteCoachStatusLabel,
  type AthleteCoach,
} from "@/domain/athlete-coaches";
import { ConnectionAvatar } from "./connection-avatar";
import { ConnectionDisconnectControl } from "./connection-disconnect-control";

export function coachSessionDate(coach: AthleteCoach) {
  const date = coach.lastSessionAt ?? coach.nextSessionAt;
  if (!date) return "No sessions yet";
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
  return coach.lastSessionAt ? label : `Next: ${label}`;
}
export function AthleteCoachRosterList({
  coaches,
  busy,
  onConnect,
  onDisconnect,
  onHistory,
  renderHistory,
}: {
  coaches: readonly AthleteCoach[];
  busy: boolean;
  onConnect: (coach: AthleteCoach) => void;
  onDisconnect: (coach: AthleteCoach) => void;
  onHistory: (coach: AthleteCoach) => void;
  renderHistory: (coach: AthleteCoach) => ReactNode;
}) {
  return (
    <div className="coach-athlete-roster-list">
      <div className="coach-athlete-roster-columns" aria-hidden="true">
        <span>Coach</span>
        <span>Status</span>
        <span>Last session</span>
        <span />
      </div>
      {coaches.length === 0 && (
        <p className="coach-athlete-roster-empty">No coaches in this view.</p>
      )}
      {coaches.map((coach) => (
        <article
          className="coach-athlete-roster-row"
          key={coach.key}
          aria-label={`${coach.name}, ${athleteCoachStatusLabel(coach)}`}
        >
          <div className="coach-athlete-roster-person">
            <ConnectionAvatar name={coach.name} imageUrl={coach.portraitUrl} />
            {coach.profileHref ? (
              <Link
                href={coach.profileHref}
                prefetch={false}
                aria-disabled={busy || undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                {coach.name}
              </Link>
            ) : (
              <strong>{coach.name}</strong>
            )}
          </div>
          <span className={`coach-athlete-roster-status ${coach.status}`}>
            {coach.status === "connected" && (
              <Check size={13} aria-hidden="true" />
            )}
            {athleteCoachStatusLabel(coach)}
          </span>
          <span className="coach-athlete-roster-date">
            {coach.lastSessionAt && (
              <span className="coach-athlete-roster-date-label">Last: </span>
            )}
            {coachSessionDate(coach)}
          </span>
          <div className="coach-athlete-roster-actions">
            {coach.status === "unconnected" && coach.canSend && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => onConnect(coach)}
              >
                <UserPlus size={14} aria-hidden="true" />
                {coach.connection ? "Reconnect" : "Connect"}
              </button>
            )}
            {coach.status === "pending" && (
              <Link
                href="/my-coaches?section=requests"
                className="coach-athlete-request-link"
                prefetch={false}
                aria-disabled={busy || undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                View request
              </Link>
            )}
            {coach.connection?.canDisconnect && (
              <details className="coach-athlete-roster-menu">
                <summary
                  aria-label={`Manage ${coach.name}`}
                  aria-disabled={busy || undefined}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  <MoreHorizontal size={20} aria-hidden="true" />
                </summary>
                <div>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => onHistory(coach)}
                  >
                    Shared history
                  </button>
                  <Link
                    href={`/messages?pair=${coach.connection.pairId}`}
                    prefetch={false}
                    aria-disabled={busy || undefined}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                    }}
                  >
                    Message coach
                  </Link>
                  <ConnectionDisconnectControl
                    name={coach.name}
                    disabled={busy}
                    onDisconnect={() => onDisconnect(coach)}
                  />
                </div>
              </details>
            )}
          </div>
          {renderHistory(coach)}
        </article>
      ))}
    </div>
  );
}
