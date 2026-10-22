import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { eventDate } from "@/features/events/event-contract";
import type { EventSearch } from "@/events/contracts";
import { EventStatus } from "@/features/events/event-ui";
import {
  coachEventHref,
  ownerPageCursor,
  ownerPageHref,
} from "@/features/coach-events/contract";
import { CoachEventsAccess } from "@/features/coach-events/access";
import {
  CoachEventsFrame,
  CoachEventsState,
} from "@/features/coach-events/screens";
import { ownedGroupEvents } from "@/server/group-sessions/owner-service";

export const metadata = { title: "Coach Events" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<EventSearch>;
}) {
  const cursor = ownerPageCursor(await searchParams);
  if (cursor === false)
    return (
      <CoachEventsFrame>
        <CoachEventsState status="invalid" />
      </CoachEventsFrame>
    );
  const href = cursor
    ? ownerPageHref("/coach/events", cursor)
    : "/coach/events";
  const state = await ownedGroupEvents(cursor);
  if (state.status === "signed-out" || state.status === "preview")
    redirect(signInHref(href));
  if (state.status !== "ready")
    return (
      <CoachEventsFrame>
        <CoachEventsState status={state.status} href={href} />
      </CoachEventsFrame>
    );
  return (
    <CoachEventsFrame>
      <CoachEventsAccess
        identity={state.context.identity}
        scope={state.context.scope}
      >
        <header className="events-heading">
          <span className="eyebrow">COACH WORKSPACE</span>
          <h1>Events</h1>
          <p>
            Create group training, review registrations and make your session
            decisions.
          </p>
        </header>
        {state.context.canDraft && (
          <Link className="button dark" href="/coach/events/new">
            Create group session
          </Link>
        )}
        {!state.context.canPublish && (
          <div className="coach-event-notice">
            <p>
              Publication and confirmation require a visible approved/demo
              profile. Existing session history remains available, with
              cancellation where eligible.
            </p>
            <Link href="/profile/coach">Review profile</Link>
          </div>
        )}
        <div className="group-history-list">
          {!state.value.items.length ? (
            <section className="events-state">
              <h2>
                {cursor
                  ? "No more sessions on this page"
                  : "No group sessions yet"}
              </h2>
              <p>A draft stays private until you review and publish it.</p>
            </section>
          ) : (
            state.value.items.map((session) => (
              <article key={session.id} className="group-history-card">
                <EventStatus session={session} />
                <h2>
                  <Link href={coachEventHref(session.id)}>{session.title}</Link>
                </h2>
                <p>
                  {eventDate(session.startsAt)} – {eventDate(session.endsAt)} ·
                  Europe/Berlin
                </p>
                <p>
                  {session.venue.name} · {session.venue.label}
                </p>
                <p>
                  {session.participantCount} / {session.maximumParticipants}{" "}
                  active seats · Minimum {session.minimumParticipants}
                </p>
                <Link href={coachEventHref(session.id)}>
                  {session.status === "draft"
                    ? "Review draft"
                    : "Open session and participants"}{" "}
                  →
                </Link>
              </article>
            ))
          )}
        </div>
        <nav className="events-pagination" aria-label="Coach event pages">
          {cursor && <Link href="/coach/events">Back to first page</Link>}
          {state.value.nextCursor && (
            <Link href={ownerPageHref("/coach/events", state.value.nextCursor)}>
              More sessions
            </Link>
          )}
        </nav>
      </CoachEventsAccess>
    </CoachEventsFrame>
  );
}
