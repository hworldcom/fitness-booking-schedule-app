import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import {
  eventDate,
  eventHref,
  groupHistoryCursor,
  groupHistoryHref,
  registrationStatus,
} from "@/features/events/event-contract";
import type { EventSearch } from "@/events/contracts";
import {
  EventStatus,
  EventTerms,
  EventsUnavailable,
} from "@/features/events/event-ui";
import { ParticipationForm } from "@/features/events/participation-form";
import { BookingPageFrame } from "@/features/profile/booking-page-frame";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { athleteGroupHistory } from "@/server/group-sessions/athlete-service";
import { BookingPageLoading } from "@/features/profile/booking-page-loading";
import "@/features/events/events.css";

export const metadata: Metadata = { title: "Group bookings" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<EventSearch>;
}) {
  const search = await searchParams;
  return (
    <BookingPageFrame active="group">
      <Suspense
        key={JSON.stringify(search)}
        fallback={<BookingPageLoading active="group" />}
      >
        <GroupSessionsContent search={search} />
      </Suspense>
    </BookingPageFrame>
  );
}

async function GroupSessionsContent({ search }: { search: EventSearch }) {
  const cursor = groupHistoryCursor(search);
  const href = cursor ? groupHistoryHref(cursor) : "/sessions/groups";
  // Malformed cursors still need the guard; valid history reads authorize themselves.
  const state =
    cursor === false
      ? await protectedPageAccess(href)
      : await athleteGroupHistory(cursor);
  if (state.status === "signed-out") redirect(signInHref(href));
  if (state.status === "forbidden")
    redirect(`${signInHref(href)}&reason=forbidden`);
  if (state.status === "preview")
    return (
      <div className="my-session-recovery">
        <section className="events-state">
          <h2>My group sessions</h2>
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
  if (state.status === "unavailable")
    return (
      <div className="my-session-recovery">
        <EventsUnavailable href={href} />
      </div>
    );
  if (cursor === false)
    return (
      <div className="my-session-recovery">
        <section className="events-state" role="alert">
          <h2>Invalid registration page</h2>
          <Link href="/sessions/groups">Return to the first page</Link>
        </section>
      </div>
    );
  return (
    <div className="group-history-page">
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
                  {(registration.status === "active" ||
                    registration.status === "pending") && (
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
            {cursor && (
              <Link href="/sessions/groups" prefetch={false}>
                Back to first page
              </Link>
            )}
            {state.value.nextCursor && (
              <Link
                href={groupHistoryHref(state.value.nextCursor)}
                prefetch={false}
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
