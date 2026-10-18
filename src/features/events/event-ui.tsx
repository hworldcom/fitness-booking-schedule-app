import Link from "next/link";
import { CalendarDays, MapPin, UsersRound, ArrowUpRight } from "lucide-react";
import type { GroupSession } from "@/domain/group-sessions";
import {
  eventDate,
  eventHref,
  eventPrice,
  eventStatus,
  eventTime,
} from "./event-contract";

export function EventStatus({ session }: { session: GroupSession }) {
  return (
    <span className={`event-status event-status-${session.displayStatus}`}>
      {eventStatus(session)}
    </span>
  );
}
export function EventCard({ session }: { session: GroupSession }) {
  return (
    <article className="event-card">
      <div className="event-card-top">
        <span className="event-discipline">{session.discipline}</span>
        <EventStatus session={session} />
      </div>
      <p className="event-card-date">
        <CalendarDays size={18} aria-hidden="true" />
        <time dateTime={session.startsAt}>{eventDate(session.startsAt)}</time>
        <span>– {eventTime(session.endsAt)}</span>
      </p>
      <h2>
        <Link href={eventHref(session)}>
          {session.title}
          <ArrowUpRight size={21} aria-hidden="true" />
        </Link>
      </h2>
      <p className="event-coach">
        With {session.coach.name} ·{" "}
        {session.coach.trustKind === "verified"
          ? "Verified coach"
          : session.coach.trustKind === "demo"
            ? "Demo coach"
            : "Coach"}
      </p>
      <p className="event-card-place">
        <MapPin size={17} aria-hidden="true" />
        <span>
          {session.venue.name}
          <small>{session.venue.label}</small>
        </span>
      </p>
      <div className="event-card-footer">
        <span>
          <UsersRound size={17} aria-hidden="true" />
          {session.participantCount} / {session.maximumParticipants} seats
          reserved
        </span>
        <strong>{eventPrice(session.priceCents)}</strong>
      </div>
      {session.priceCents > 0 && (
        <p className="event-price-note">Pay at session</p>
      )}
    </article>
  );
}
export function EventTerms({ session }: { session: GroupSession }) {
  return (
    <dl className="event-terms">
      {session.sessionType && (
        <div>
          <dt>Session type</dt>
          <dd>{session.sessionType.name}</dd>
        </div>
      )}
      <div>
        <dt>Date and time</dt>
        <dd>
          <time dateTime={session.startsAt}>{eventDate(session.startsAt)}</time>{" "}
          –{" "}
          {eventDate(session.startsAt, false) ===
          eventDate(session.endsAt, false)
            ? eventTime(session.endsAt)
            : eventDate(session.endsAt)}
          <small>Europe/Berlin</small>
        </dd>
      </div>
      <div>
        <dt>Training location</dt>
        <dd>
          {session.venue.name}
          <small>{session.venue.label}</small>
        </dd>
      </div>
      <div>
        <dt>Discipline and level</dt>
        <dd>
          {session.discipline}
          <small>{session.intendedLevel}</small>
        </dd>
      </div>
      <div>
        <dt>{session.status === "draft" ? "Capacity" : "Reserved seats"}</dt>
        <dd>
          {session.participantCount} of {session.maximumParticipants}
          <small>
            {`Minimum ${session.minimumParticipants} ${session.minimumParticipants === 1 ? "participant" : "participants"}${session.status === "open" ? " to enable coach confirmation" : ""}`}
          </small>
        </dd>
      </div>
      <div>
        <dt>Registration and decision deadline</dt>
        <dd>
          <time dateTime={session.decisionDeadlineAt}>
            {eventDate(session.decisionDeadlineAt)}
          </time>
          <small>Europe/Berlin · Joining closes at this deadline.</small>
        </dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd>
          {eventPrice(session.priceCents)}
          <small>
            {session.priceCents === 0
              ? "No participation fee."
              : "Pay at session. Includes required venue and participation costs. MovX does not collect or verify payment."}
          </small>
        </dd>
      </div>
    </dl>
  );
}
export function EventsUnavailable({ href = "/events" }: { href?: string }) {
  return (
    <section className="events-state" role="status">
      <h2>Group sessions are unavailable right now</h2>
      <p>
        MovX could not verify the current information. This does not mean there
        are no sessions or registrations.
      </p>
      <a className="button secondary" href={href}>
        Try again
      </a>
    </section>
  );
}
