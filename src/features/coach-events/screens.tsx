import Link from "next/link";
import type { ReactNode } from "react";
import type {
  GroupSession,
  GroupPage,
  GroupRosterItem,
} from "@/domain/group-sessions";
import { EventStatus, EventTerms } from "@/features/events/event-ui";
import { eventDate, eventHref } from "@/features/events/event-contract";
import {
  coachEventHref,
  ownerPageHref,
  type CoachEventContext,
} from "./contract";
import { CoachEventDecisionForm } from "./forms";
import "@/features/events/events.css";
import "./coach-events.css";

export function CoachEventsFrame({ children }: { children: ReactNode }) {
  return <div className="events-page coach-events-page">{children}</div>;
}
export function CoachEventsState({
  status,
  href = "/coach/events",
}: {
  status: string;
  href?: string;
}) {
  const denied = ["forbidden", "conflict", "invalid"].includes(status);
  return (
    <section className="events-state" role="alert">
      <h1>
        {denied
          ? "This coach event is not available to this account"
          : "Coach Events could not be verified"}
      </h1>
      <p>
        {denied
          ? "Open your own Events or review your coach access. No other coach’s roster or draft is shown."
          : "No empty inventory or successful save is assumed. Reload the current state before trying an action again."}
      </p>
      <a href={href}>Reload Events</a> ·{" "}
      <Link href="/profile/coach">Review coach profile</Link>
    </section>
  );
}
export function CoachEventDetail({
  session,
  roster,
  context,
  after,
}: {
  session: GroupSession;
  roster: GroupPage<GroupRosterItem>;
  context: CoachEventContext;
  after: boolean;
}) {
  const selectedType = session.sessionType
    ? context.sessionTypes?.find((t) => t.id === session.sessionType?.id)
    : null;
  const typeCanPublish =
    !session.sessionType ||
    Boolean(selectedType && !selectedType.archived && selectedType.bookable);
  return (
    <>
      <header className="events-heading">
        <span className="eyebrow">YOUR GROUP SESSION</span>
        <h1>{session.title}</h1>
        {session.sessionType && (
          <p>{session.sessionType.name} · Session type</p>
        )}
        <EventStatus session={session} />
        <p>
          {session.status === "draft"
            ? "Review every term before you publish. This draft is private and blocks no coach time."
            : "These are the published terms. Corrections require cancelling this session and creating a new draft; registrations never transfer."}
        </p>
      </header>
      <div className="coach-event-detail-grid">
        <section className="coach-event-panel" aria-label="Session terms">
          <h2>
            {session.status === "draft"
              ? "Publication review"
              : "Published session"}
          </h2>
          <p className="coach-event-description">
            {session.description || "No additional description."}
          </p>
          <EventTerms session={session} />
          {session.publishedAt && (
            <Link href={eventHref(session)}>View public session</Link>
          )}
        </section>
        <aside className="coach-event-panel" aria-label="Coach decisions">
          <h2>
            {session.status === "draft"
              ? "Ready to publish?"
              : "Coach decisions"}
          </h2>
          {session.status === "draft" ? (
            <>
              {context.canDraft && session.canEdit && (
                <Link
                  className="button secondary"
                  href={`${coachEventHref(session.id)}/edit`}
                >
                  Edit draft
                </Link>
              )}
              {context.canPublish && typeCanPublish ? (
                <CoachEventDecisionForm
                  id={session.id}
                  scope={context.scope}
                  revision={session.revision}
                  intent="publish"
                  label="Publish session"
                  acknowledgement="I reviewed the terms above. Publishing freezes them and reserves my coach time; the session still needs my manual confirmation."
                />
              ) : (
                <p>
                  {typeCanPublish ? (
                    "Publishing requires a visible approved/demo coach profile. Existing drafts remain private."
                  ) : (
                    <>
                      Enable or replace this session type before publishing.{" "}
                      <Link href="/coach/session-types">
                        Manage session types
                      </Link>
                    </>
                  )}
                </p>
              )}
              <CoachEventDecisionForm
                id={session.id}
                scope={context.scope}
                revision={session.revision}
                intent="delete-draft"
                label="Delete draft"
                acknowledgement="Delete this unpublished draft permanently."
              />
            </>
          ) : (
            <>
              {["cancelled", "not-confirmed", "ended"].includes(
                session.displayStatus,
              ) && (
                <p>
                  This session is closed. Its original terms and participant
                  history remain available.
                </p>
              )}
              {session.status === "open" && (
                <p>
                  Reaching the minimum never confirms automatically. Confirm
                  only before the deadline with enough current registrations.
                  Otherwise this session becomes Not confirmed.
                </p>
              )}
              {session.canConfirm && context.canPublish && (
                <CoachEventDecisionForm
                  id={session.id}
                  scope={context.scope}
                  revision={session.revision}
                  intent="confirm"
                  label="Confirm session"
                  acknowledgement="I am confirming that I will run this session under its published terms."
                />
              )}
              {session.status === "confirmed" && (
                <p>
                  The session remains confirmed if participants withdraw below
                  the minimum. Cancel explicitly if you cannot run it.
                  Confirmation proves neither payment nor attendance.
                </p>
              )}
              {session.canCancel && (
                <CoachEventDecisionForm
                  id={session.id}
                  scope={context.scope}
                  revision={session.revision}
                  intent="cancel"
                  label="Cancel session"
                  acknowledgement="Cancel this session and end all active seat reservations. This cannot be undone."
                />
              )}
              {!context.canPublish && (
                <p>
                  New publication and confirmation are unavailable with your
                  current coach access or hidden profile. Eligible existing
                  sessions can still be cancelled.
                </p>
              )}
            </>
          )}
          <div className="coach-event-actions">
            <Link href="/coach">Review Schedule</Link>
            <Link href="/coach?view=bookings">Review Bookings</Link>
          </div>
        </aside>
      </div>
      <section
        className="coach-event-panel"
        aria-label="Private participant roster"
      >
        <h2>Participants</h2>
        <p>
          Private to the owning coach. Names and initials only; group
          registration grants no connection, private profile, notes or photo
          access.
        </p>
        {!roster.items.length ? (
          <p>
            {after
              ? "No more registrations on this page."
              : "No registrations yet."}
          </p>
        ) : (
          <ul className="coach-event-roster">
            {roster.items.map((item) => (
              <li key={item.id}>
                <span className="coach-event-initials" aria-hidden="true">
                  {item.initials}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.status === "active"
                      ? "Seat reserved"
                      : item.status === "withdrawn"
                        ? "Withdrew"
                        : item.status === "session-cancelled"
                          ? "Session cancelled"
                          : "Session not confirmed"}{" "}
                    · Registered {eventDate(item.createdAt)}
                    {item.resolvedAt && (
                      <> · Updated {eventDate(item.resolvedAt)}</>
                    )}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Participant pages" className="events-pagination">
          {after && (
            <Link href={coachEventHref(session.id)}>Back to first page</Link>
          )}
          {roster.nextCursor && (
            <Link
              href={ownerPageHref(
                coachEventHref(session.id),
                roster.nextCursor,
              )}
            >
              More participants
            </Link>
          )}
        </nav>
      </section>
    </>
  );
}
