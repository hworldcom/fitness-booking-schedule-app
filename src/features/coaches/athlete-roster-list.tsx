"use client";
import Link from "next/link";
import { Check, MoreHorizontal, UserPlus } from "lucide-react";
import type { ConnectionDecision } from "@/domain/coach-athlete-connections";
import {
  coachAthleteHref,
  coachAthleteStatusLabel,
  type CoachAthlete,
} from "@/domain/coach-athletes";
import { ConnectionAvatar } from "@/features/connections/connection-avatar";
import { ConnectionDisconnectControl } from "@/features/connections/connection-disconnect-control";

export function athleteSessionDate(athlete: CoachAthlete) {
  const date = athlete.lastSessionAt ?? athlete.nextSessionAt;
  if (!date) return "No sessions yet";
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
  return athlete.lastSessionAt ? label : `Next: ${label}`;
}
export function CoachAthleteRosterList({
  athletes,
  busy,
  mayInitiate,
  onConnect,
  onDecision,
}: {
  athletes: readonly CoachAthlete[];
  busy: boolean;
  mayInitiate: boolean;
  onConnect: (athlete: CoachAthlete) => void;
  onDecision: (athlete: CoachAthlete, intent: ConnectionDecision) => void;
}) {
  return (
    <div className="coach-athlete-roster-list">
      <div className="coach-athlete-roster-columns" aria-hidden="true">
        <span>Athlete</span>
        <span>Status</span>
        <span>Last session</span>
        <span />
      </div>
      {athletes.length === 0 && (
        <p className="coach-athlete-roster-empty">No athletes in this view.</p>
      )}
      {athletes.map((athlete) => (
        <article
          className="coach-athlete-roster-row"
          key={athlete.key}
          aria-label={`${athlete.name}, ${coachAthleteStatusLabel(athlete)}`}
        >
          <div className="coach-athlete-roster-person">
            <ConnectionAvatar
              name={athlete.name}
              imageUrl={athlete.connection?.athleteAvatarUrl ?? null}
            />
            <Link
              href={coachAthleteHref(athlete)}
              prefetch={false}
              aria-disabled={busy || undefined}
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              {athlete.name}
            </Link>
          </div>
          <span className={`coach-athlete-roster-status ${athlete.status}`}>
            {athlete.status === "connected" && (
              <Check size={13} aria-hidden="true" />
            )}
            {coachAthleteStatusLabel(athlete)}
          </span>
          <span className="coach-athlete-roster-date">
            {athlete.lastSessionAt && (
              <span className="coach-athlete-roster-date-label">Last: </span>
            )}
            {athleteSessionDate(athlete)}
          </span>
          <div className="coach-athlete-roster-actions">
            {athlete.status === "external" && mayInitiate && (
              <Link
                className="button secondary"
                href={`/coach/athletes/external/${athlete.externalClientId}#external-athlete-invitation`}
                prefetch={false}
                aria-disabled={busy || undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                Invite
              </Link>
            )}
            {athlete.status === "unconnected" &&
              athlete.canSend &&
              mayInitiate && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onConnect(athlete)}
                >
                  <UserPlus size={14} aria-hidden="true" />
                  {athlete.connection ? "Reconnect" : "Connect"}
                </button>
              )}
            {athlete.status === "pending" && (
              <Link
                href="/coach/athletes?section=requests"
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
            {athlete.connection?.canDisconnect && (
              <details className="coach-athlete-roster-menu">
                <summary
                  aria-label={`Manage ${athlete.name}`}
                  aria-disabled={busy || undefined}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  <MoreHorizontal size={20} aria-hidden="true" />
                </summary>
                <div>
                  <Link
                    href={coachAthleteHref(athlete)}
                    prefetch={false}
                    aria-disabled={busy || undefined}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                    }}
                  >
                    Session history
                  </Link>
                  <ConnectionDisconnectControl
                    name={athlete.name}
                    disabled={busy}
                    onDisconnect={() => onDecision(athlete, "disconnect")}
                  />
                </div>
              </details>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
