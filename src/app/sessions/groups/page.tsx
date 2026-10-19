import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import {
  eventDate,
  eventHref,
  groupHistoryCursor,
  groupHistoryHref,
  registrationStatus,
  type EventSearch,
} from "@/features/events/event-contract";
import {
  EventStatus,
  EventTerms,
  EventsUnavailable,
} from "@/features/events/event-ui";
import { ParticipationForm } from "@/features/events/participation-form";
import {
  MySessionsHeading,
  MySessionsNavigation,
} from "@/features/profile/my-sessions-navigation";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { athleteGroupHistory } from "@/server/group-sessions/athlete-service";
import "@/features/events/events.css";

export const metadata: Metadata = { title: "My group sessions" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<EventSearch>;
}) {
  const search = await searchParams;
  const cursor = groupHistoryCursor(search);
  const href = cursor ? groupHistoryHref(cursor) : "/sessions/groups";
  const access = await protectedPageAccess(href);
  if (access.status === "preview")
    return (
      <div className="events-page my-session-recovery">
        <MySessionsNavigation active="group" />
        <section className="events-state">
          <h1>My group sessions</h1>
          <p>
            Sign in to see only your own group reservations and retained
            history.
          </p>
          <Link href={signInHref(href)} className="button dark">
            Sign in
          </Link>
        </section>
      </div>
    );
  if (access.status === "unavailable")
    return (
      <div className="events-page my-session-recovery">
        <MySessionsNavigation active="group" />
        <EventsUnavailable href={href} />
      </div>
    );
  if (cursor === false)
    return (
      <div className="events-page my-session-recovery">
        <MySessionsNavigation active="group" />
        <section className="events-state" role="alert">
          <h1>Invalid registration page</h1>
          <Link href="/sessions/groups">Return to the first page</Link>
        </section>
      </div>
    );
  const state = await athleteGroupHistory(cursor);
  if (state.status === "signed-out" || state.status === "forbidden")
    redirect(signInHref(href));
  return (
    <div className="events-page group-history-page">
      <MySessionsHeading active="group" />
      <Link href="/events" className="button dark">
        Discover group sessions
      </Link>
      {state.status !== "ready" ? (
        <EventsUnavailable href={href} />
      ) : (
        <>
          {!state.value.items.length ? (
            <section className="events-state">
              <h2>
                {cursor
                  ? "No more registrations on this page"
                  : "No group registrations yet"}
              </h2>
              <p>
                {cursor
                  ? "Return to the first page to see your recent registrations."
                  : "Explore coach-led group training and choose a session to reserve a seat."}
              </p>
            </section>
          ) : (
            <div className="group-history-list">
              {state.value.items.map(({ session, registration }) => (
                <article className="group-history-card" key={registration.id}>
                  <div className="event-card-top">
                    <span className="event-discipline">
                      {session.discipline}
                    </span>
                    <EventStatus session={session} />
                  </div>
                  <h2>
                    <Link href={eventHref(session)}>{session.title}</Link>
                  </h2>
                  <p>With {session.coach.name}</p>
                  <p>
                    <strong>{registrationStatus(registration)}</strong> ·
                    Registered {eventDate(registration.createdAt)}
                    {registration.resolvedAt && (
                      <> · Updated {eventDate(registration.resolvedAt)}</>
                    )}
                  </p>
                  <EventTerms session={session} />
                  {registration.status === "active" && (
                    <ParticipationForm
                      session={session}
                      registration={registration}
                      scope={state.scope}
                      joinId={randomUUID()}
                      history
                    />
                  )}
                  <Link href={eventHref(session)}>View session details →</Link>
                </article>
              ))}
            </div>
          )}
          <nav
            className="events-pagination"
            aria-label="My group registration pages"
          >
            {cursor && <Link href="/sessions/groups">Back to first page</Link>}
            {state.value.nextCursor && (
              <Link
                href={groupHistoryHref(state.value.nextCursor)}
                className="button secondary"
              >
                Older registrations →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
