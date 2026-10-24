import Link from "next/link";
import { CalendarDays, MapPin, UsersRound, ArrowUpRight } from "lucide-react";
import type { GroupSession } from "@/domain/group-sessions";
import type { Ref } from "react";
import type { EventCardPresentation } from "@/domain/event-banners";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import { EventCardCover } from "./event-card-cover";
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
export function EventCard({
  session,
  presentation,
  selected = false,
  cardRef,
  onShowOnMap,
}: {
  session: GroupSession;
  presentation?: EventCardPresentation;
  selected?: boolean;
  cardRef?: Ref<HTMLElement>;
  onShowOnMap?: () => void;
}) {
  const participantsNeeded = Math.max(
    0,
    session.minimumParticipants - session.approvedParticipantCount,
  );
  const waitingForCoach = session.displayStatus === "open";
  const canInvite =
    session.canJoin &&
    session.participantCount < session.maximumParticipants &&
    (waitingForCoach || session.displayStatus === "confirmed");
  return (
    <article
      className={`event-card${selected ? " selected" : ""}`}
      ref={cardRef}
      tabIndex={-1}
      aria-label={session.title}
    >
      <Link
        className="event-card-banner-link"
        href={eventHref(session)}
        aria-label={`View ${session.title}`}
        tabIndex={-1}
      >
        <EventCardCover
          event={presentation?.eventBanner ?? null}
          coach={presentation?.coachBanner ?? null}
        />
      </Link>
      <Link
        className="event-card-coach"
        href={presentation?.coachHref ?? `/coaches/${session.coach.slug}`}
      >
        <Avatar
          initials={profileInitials(session.coach.name)}
          imageUrl={presentation?.portraitUrl ?? null}
        />
        <span>
          <strong>{session.coach.name}</strong>
          <small>
            {session.coach.trustKind === "verified"
              ? "Verified coach"
              : session.coach.trustKind === "demo"
                ? "Demo coach"
                : "Coach"}
          </small>
        </span>
      </Link>
      <div className="event-card-top">
        <span className="event-discipline">{session.discipline}</span>
        <EventStatus session={session} />
      </div>
      <p className="event-card-date">
        <CalendarDays size={18} aria-hidden="true" />
        <time dateTime={session.startsAt}>{eventDate(session.startsAt)}</time>
        <span>– {eventTime(session.endsAt)}</span>
      </p>
      <h3>
        <Link href={eventHref(session)}>
          {session.title}
          <ArrowUpRight size={21} aria-hidden="true" />
        </Link>
      </h3>
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
      <div className="event-card-enrollment">
        <strong>
          {session.displayStatus === "confirmed" ||
          session.displayStatus === "ended"
            ? "Initial minimum"
            : "Minimum"}{" "}
          {session.minimumParticipants}{" "}
          {session.minimumParticipants === 1 ? "participant" : "participants"}
        </strong>
        {waitingForCoach && (
          <p>
            {participantsNeeded > 0
              ? `${participantsNeeded} more approved ${participantsNeeded === 1 ? "participant" : "participants"} needed before coach confirmation.`
              : "Approved minimum reached. Awaiting coach confirmation."}
          </p>
        )}
        {canInvite && (
          <p className="event-card-invite">
            {waitingForCoach && participantsNeeded > 0
              ? "Invite a friend to help this class happen."
              : "Training is better together. Invite a friend."}
          </p>
        )}
      </div>
      {onShowOnMap && (
        <button
          className="event-show-map"
          type="button"
          onClick={onShowOnMap}
          aria-pressed={selected}
        >
          <MapPin size={16} aria-hidden="true" /> Show on map
          <span className="sr-only">: {session.title}</span>
        </button>
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
            {session.approvedParticipantCount} individually approved
          </small>
          <small>
            {`Minimum ${session.minimumParticipants} ${session.minimumParticipants === 1 ? "participant" : "participants"}${session.status === "open" ? " approved to enable coach confirmation" : ""}`}
          </small>
        </dd>
      </div>
      <div>
        <dt>Registration and decision deadline</dt>
        <dd>
          <time dateTime={session.decisionDeadlineAt}>
            {eventDate(session.decisionDeadlineAt)}
          </time>
          <small>
            Europe/Berlin · Joining and participation approval close at this
            deadline.
          </small>
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
