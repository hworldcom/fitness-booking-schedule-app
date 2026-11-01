"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import type {
  ClientCoachBookingRequestProjection,
  CoachBookingRequestPage,
} from "@/domain/coach-booking-requests";
import { sessionTitle } from "@/domain/session-titles";
import { ClientSessionCoachIdentity } from "./client-session-coach-identity";
import { ClientSessionDateTile } from "./client-session-date-tile";
import { clientBookingRequestStatusLabel } from "./client-booking-request-model";
import {
  historyPreviewBookings,
  historyPreviewHref,
  historyPreviewStatus,
  type HistoryPreviewView,
} from "./session-history-preview-model";

type PreviewProps = {
  view: HistoryPreviewView;
  bookings: readonly PrivateBookingProjection[];
  requests: CoachBookingRequestPage<ClientCoachBookingRequestProjection>;
  referenceTime: string;
};

export function SessionHistoryPreview({
  actorIdentity,
  ...props
}: PreviewProps & { actorIdentity: string }) {
  const { actor } = useActor();
  if (
    actor.status !== "authorized" ||
    `${actor.demoRun.slug}:${actor.profile.slug}:${actor.role}` !==
      actorIdentity
  )
    return <p role="status">Verifying your training history…</p>;
  return <SessionHistoryPreviewContent {...props} />;
}

function sessionTime(booking: PrivateBookingProjection) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.coachTimezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(booking.scheduledStartAt));
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.coachTimezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${clock.format(new Date(booking.scheduledStartAt))}–${clock.format(new Date(booking.scheduledEndAt))}`;
}

export function SessionHistoryPreviewContent({
  view,
  bookings,
  requests,
  referenceTime,
}: PreviewProps) {
  const groups = historyPreviewBookings(bookings, referenceTime);
  const items = view === "requests" ? [] : groups[view];
  return (
    <section
      className="history-preview"
      aria-label="Private session history preview"
    >
      <div className="history-preview-notice">
        <span>
          <span className="history-preview-dot" />
          Layout preview · Your sessions
        </span>
        <Link href="/sessions">
          Return to current layout <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <header className="history-preview-heading">
        <span className="eyebrow">YOUR COACHING JOURNEY</span>
        <h2>Every session. Easy to come back to.</h2>
        <p>
          Your upcoming training, previous sessions and notes, in one place.
        </p>
      </header>
      <nav
        className="history-preview-tabs"
        aria-label="Private session sections"
      >
        <a
          href={historyPreviewHref("upcoming")}
          aria-current={view === "upcoming" ? "page" : undefined}
        >
          Upcoming <span>{groups.upcoming.length}</span>
        </a>
        <a
          href={historyPreviewHref("past")}
          aria-current={view === "past" ? "page" : undefined}
        >
          Past sessions <span>{groups.past.length}</span>
        </a>
        <a
          href={historyPreviewHref("requests")}
          aria-current={view === "requests" ? "page" : undefined}
        >
          Booking requests
        </a>
      </nav>
      {view === "requests" ? (
        <section
          className="history-preview-results"
          aria-labelledby="history-preview-results-title"
        >
          <div className="history-preview-results-heading">
            <div>
              <h3 id="history-preview-results-title">Booking requests</h3>
              <p>Requests stay separate from your confirmed session records.</p>
            </div>
            <Link
              className="button secondary"
              href="/sessions#booking-requests"
            >
              Manage requests <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {requests.items.length === 0 ? (
            <div className="history-preview-empty">
              <CalendarDays aria-hidden="true" />
              <h4>No booking requests yet</h4>
              <p>
                Your requests will appear here after you choose a coach and
                time.
              </p>
              <Link href="/explore">Find a coach</Link>
            </div>
          ) : (
            <div className="history-preview-list">
              {requests.items.map((request) => (
                <article className="history-preview-request" key={request.id}>
                  <ClientSessionDateTile
                    timestamp={request.scheduledStartAt}
                    timeZone={request.coachTimezone}
                  />
                  <div>
                    <strong>{request.coachDisplayName}</strong>
                    <p>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: request.coachTimezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(request.scheduledStartAt))}
                    </p>
                    <span>
                      {clientBookingRequestStatusLabel(request.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
          {requests.nextCursor && (
            <p className="history-preview-more">
              Showing the {requests.items.length} most recent requests.{" "}
              <Link href="/sessions#booking-requests">
                Open all request history
              </Link>
            </p>
          )}
        </section>
      ) : (
        <section
          className="history-preview-results"
          aria-labelledby="history-preview-results-title"
        >
          <div className="history-preview-results-heading">
            <div>
              <h3 id="history-preview-results-title">
                {view === "past" ? "Past sessions" : "Coming up"}
              </h3>
              <p>
                {view === "past"
                  ? "Your previous and cancelled sessions, newest first. Open a session to revisit its plan, notes and videos."
                  : "Your confirmed sessions, in date order. Open a session for its plan, notes and schedule."}
              </p>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="history-preview-empty">
              {view === "past" ? (
                <BookOpen aria-hidden="true" />
              ) : (
                <CalendarDays aria-hidden="true" />
              )}
              <h4>
                {view === "past"
                  ? "Your training story starts here"
                  : "A little room for your next session"}
              </h4>
              <p>
                {view === "past"
                  ? "Previous sessions and their notes will be easy to revisit here."
                  : "No upcoming private sessions. Your previous sessions are still in Past sessions."}
              </p>
              <Link
                className="button secondary"
                href={
                  view === "past" ? historyPreviewHref("upcoming") : "/explore"
                }
              >
                {view === "past" ? "See upcoming sessions" : "Find a coach"}{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="history-preview-list">
              {items.map((booking) => (
                <article
                  className="history-preview-card"
                  key={booking.id}
                  data-booking-id={booking.id}
                >
                  <ClientSessionDateTile
                    timestamp={booking.scheduledStartAt}
                    timeZone={booking.coachTimezone}
                  />
                  <div className="history-preview-card-main">
                    <div className="history-preview-card-top">
                      <ClientSessionCoachIdentity
                        displayName={booking.coachDisplayName}
                        slug={booking.coachSlug}
                        portraitUrl={booking.coachPortraitUrl}
                      />
                      <span
                        className={`coach-booking-status ${booking.status}`}
                      >
                        {historyPreviewStatus(booking)}
                      </span>
                    </div>
                    <h4>{sessionTitle(booking.title)}</h4>
                    <p>
                      <Clock3 size={15} aria-hidden="true" />
                      {sessionTime(booking)}
                    </p>
                    <p>
                      <MapPin size={15} aria-hidden="true" />
                      {booking.location.name}
                    </p>
                    {booking.hasSessionDetails ? (
                      <Link
                        className="button dark history-preview-open"
                        href={`/sessions/preview/${booking.id}?view=${view}`}
                        aria-label={`Session & notes with ${booking.coachDisplayName}, ${sessionTime(booking)}`}
                      >
                        <BookOpen size={16} aria-hidden="true" />
                        Session & notes{" "}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : (
                      <p className="history-preview-legacy">
                        This older session has no detailed session record.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
