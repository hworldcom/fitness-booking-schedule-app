"use client";

import { useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  MapPin,
  RotateCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import type {
  MemberClassBookingStatus,
  MemberClassSchedule,
  MemberClassSession,
} from "@/domain/class-reservations";
import {
  cancelMemberClassReservationRequest,
  fetchMemberClassSchedule,
  reserveMemberClassRequest,
} from "./reservation-client";

const statusLabels: Record<MemberClassBookingStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  full: "Full",
  "same-day-conflict": "Another visit held that day",
  "allowance-exhausted": "No included uses left",
  past: "Finished",
  "member-cancelled": "Cancelled by you",
  "session-cancelled": "Cancelled by gym",
  "checked-in": "Checked in",
  "no-show": "Not checked in",
};

function classDate(session: MemberClassSession) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: session.timezone,
  }).format(new Date(session.startsAt));
}

function classTime(session: MemberClassSession) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: session.timezone,
  });
  return `${formatter.format(new Date(session.startsAt))}–${formatter.format(new Date(session.endsAt))}`;
}

function groupedSessions(sessions: readonly MemberClassSession[]) {
  return sessions.reduce<Map<string, MemberClassSession[]>>(
    (groups, session) => {
      const group = groups.get(session.serviceDate) ?? [];
      group.push(session);
      groups.set(session.serviceDate, group);
      return groups;
    },
    new Map(),
  );
}

function mutationMessage(status: string) {
  switch (status) {
    case "daily-conflict":
      return "You already have an included visit held or used for that day.";
    case "allowance-exhausted":
      return "Your Basic plan has no unheld included uses remaining.";
    case "full":
      return "That class just filled up. No reservation was created.";
    case "class-unavailable":
    case "too-late":
      return "That class is no longer available to reserve or cancel.";
    case "state-conflict":
    case "operation-conflict":
      return "The reservation changed. Refresh the schedule before trying again.";
    case "signed-out":
      return "Your session ended. Sign in again before changing a reservation.";
    default:
      return "The reservation service is temporarily unavailable. Your existing reservation state is unchanged.";
  }
}

export function MemberClassSchedulePanel({
  initialSchedule,
  onScheduleChange,
}: {
  initialSchedule: MemberClassSchedule | null;
  onScheduleChange?: (schedule: MemberClassSchedule) => void;
}) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const operationIds = useRef(new Map<string, string>());

  async function refresh() {
    const result = await fetchMemberClassSchedule();
    if (result.status === "ready") {
      setSchedule(result.schedule);
      onScheduleChange?.(result.schedule);
      return true;
    }
    setNotice(
      "The latest schedule could not be loaded. The last confirmed view remains on screen.",
    );
    return false;
  }

  async function reserve(session: MemberClassSession) {
    setPendingId(session.id);
    setNotice(null);
    const operationId =
      operationIds.current.get(session.id) ?? crypto.randomUUID();
    operationIds.current.set(session.id, operationId);
    const result = await reserveMemberClassRequest(operationId, session.id);
    const refreshed = await refresh();
    if (result.status === "reserved" || result.status === "existing") {
      setNotice(
        refreshed
          ? schedule?.plan.id === "basic"
            ? "Reserved. Your seat and one Basic use are held; nothing is consumed until staff confirm attendance."
            : "Reserved. Your seat is held; attendance still requires staff confirmation."
          : "The reservation was accepted. Refresh again to load its latest state.",
      );
    } else {
      setNotice(mutationMessage(result.status));
    }
    setPendingId(null);
  }

  async function cancel(session: MemberClassSession) {
    if (!session.reservation) return;
    setPendingId(session.id);
    setNotice(null);
    const result = await cancelMemberClassReservationRequest(
      session.reservation.id,
    );
    const refreshed = await refresh();
    if (result.status === "cancelled" || result.status === "existing") {
      operationIds.current.delete(session.id);
      setNotice(
        refreshed
          ? "Reservation cancelled. The seat and any held Basic use were released. You can reserve this class again while it remains available."
          : "The cancellation was accepted. Refresh again to load its latest state.",
      );
    } else {
      setNotice(mutationMessage(result.status));
    }
    setPendingId(null);
  }

  const groups: Map<string, MemberClassSession[]> = schedule
    ? groupedSessions(schedule.sessions)
    : new Map<string, MemberClassSession[]>();

  return (
    <section
      className="member-class-schedule"
      aria-labelledby="class-schedule-title"
    >
      <div className="class-schedule-heading">
        <div>
          <span className="eyebrow">INCLUDED CLASS SCHEDULE</span>
          <h2 id="class-schedule-title">Plan your next session.</h2>
          <p>
            Classes shown here belong to your four selected gyms. A reservation
            holds access; it is not attendance until gym staff confirm it.
          </p>
        </div>
        <button
          type="button"
          className="button secondary schedule-refresh"
          onClick={() => void refresh()}
          disabled={pendingId !== null}
        >
          <RotateCw size={15} aria-hidden="true" /> Refresh
        </button>
      </div>

      {schedule && (
        <div className="class-schedule-policy">
          <Check size={17} aria-hidden="true" />
          <p>
            {schedule.plan.id === "basic" ? (
              <>
                <strong>Basic:</strong>{" "}
                {(schedule.plan.includedCheckins ?? 0) -
                  schedule.plan.includedCheckinsUsed -
                  schedule.plan.includedCheckinsHeld}{" "}
                available to reserve · {schedule.plan.includedCheckinsHeld} held
                by reservations · {schedule.plan.includedCheckinsUsed} confirmed
                check-ins.
              </>
            ) : (
              <>
                <strong>Classic:</strong> there is no monthly class counter, but
                only one included visit can be held or used per venue-local day.
              </>
            )}
          </p>
        </div>
      )}

      {notice && (
        <div
          className="membership-message warning class-schedule-notice"
          role="status"
          aria-live="polite"
        >
          <CircleAlert size={17} aria-hidden="true" /> {notice}
        </div>
      )}

      {!schedule ? (
        <div className="class-schedule-empty">
          <h3>The class schedule is temporarily unavailable.</h3>
          <p>
            Your membership remains active. Refresh to try loading it again.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </div>
      ) : schedule.sessions.length === 0 ? (
        <div className="class-schedule-empty">
          <h3>No included classes are scheduled in this membership period.</h3>
          <p>Your open-gym membership access is unchanged.</p>
        </div>
      ) : (
        <div className="class-schedule-days">
          {[...groups.entries()].map(([serviceDate, sessions]) => (
            <section
              className="class-schedule-day"
              key={serviceDate}
              aria-labelledby={`classes-${serviceDate}`}
            >
              <h3 id={`classes-${serviceDate}`}>
                <CalendarDays size={17} aria-hidden="true" />
                {classDate(sessions[0]!)}
              </h3>
              <div className="class-session-grid">
                {sessions.map((session) => {
                  const pending = pendingId === session.id;
                  const reserveEnabled = session.bookingStatus === "available";
                  const cancelEnabled = session.bookingStatus === "reserved";
                  return (
                    <article
                      className={`class-session-card status-${session.bookingStatus}`}
                      data-session-id={session.id}
                      key={session.id}
                    >
                      <div className="class-session-topline">
                        <span>{session.discipline}</span>
                        <span className="class-session-status">
                          {statusLabels[session.bookingStatus]}
                        </span>
                      </div>
                      <h4>{session.title}</h4>
                      <div className="class-session-meta">
                        <span>
                          <Clock3 size={14} aria-hidden="true" />{" "}
                          {classTime(session)}
                        </span>
                        <span>
                          <MapPin size={14} aria-hidden="true" />{" "}
                          {session.venue.name}
                        </span>
                        <span>
                          <UserRound size={14} aria-hidden="true" />{" "}
                          {session.trainer.name}
                        </span>
                        <span>
                          <UsersRound size={14} aria-hidden="true" />{" "}
                          {session.remainingCapacity} of {session.capacity}{" "}
                          spots left
                        </span>
                      </div>
                      <details className="class-session-details">
                        <summary>Class details</summary>
                        <p>{session.description}</p>
                        <small>{session.trainer.title}</small>
                      </details>
                      {session.bookingStatus === "reserved" && (
                        <p className="class-session-held-copy">
                          {session.reservation?.holdsBasicUse
                            ? "Seat + one Basic use held. Not attendance yet."
                            : "Seat held. Not attendance yet."}
                        </p>
                      )}
                      <button
                        type="button"
                        className={`button ${cancelEnabled ? "secondary" : "dark"} class-session-action`}
                        disabled={
                          pending || (!reserveEnabled && !cancelEnabled)
                        }
                        onClick={() =>
                          void (cancelEnabled
                            ? cancel(session)
                            : reserve(session))
                        }
                      >
                        {pending
                          ? "Updating…"
                          : cancelEnabled
                            ? "Cancel reservation"
                            : reserveEnabled
                              ? "Reserve included class"
                              : statusLabels[session.bookingStatus]}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
