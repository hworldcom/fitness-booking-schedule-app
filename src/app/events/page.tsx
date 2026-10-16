import type { Metadata } from "next";
import Link from "next/link";
import { COACH_DISCIPLINES } from "@/domain/coaches";
import { parseGroupSessionResult } from "@/domain/group-sessions";
import {
  eventListQuery,
  eventPageHref,
  parseEventFilters,
  type EventSearch,
} from "@/features/events/event-contract";
import { EventCard, EventsUnavailable } from "@/features/events/event-ui";
import { publicGroupSessions } from "@/server/group-sessions/service";
import "@/features/events/events.css";

export const metadata: Metadata = {
  title: "Group training in Berlin",
  description:
    "Discover coach-led group training in Berlin. Reserve a seat in a Free or pay-at-session activity.",
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<EventSearch>;
}) {
  const filters = parseEventFilters(await searchParams);
  const result = filters
    ? await publicGroupSessions(eventListQuery(filters))
    : null;
  const page =
    result?.status === "ready"
      ? parseGroupSessionResult("public-list", result.value)
      : null;
  return (
    <div className="events-page">
      <header className="events-heading">
        <span className="eyebrow">GROUP TRAINING · BERLIN</span>
        <h1>Train together.</h1>
        <p>
          Find your next group session. Reserve a seat and check the coach’s
          confirmation before you go.
        </p>
        <Link href="/sessions/groups">My group sessions →</Link>
      </header>
      <form
        action="/events"
        method="get"
        className="events-filters"
        aria-label="Filter group sessions"
      >
        <label>
          Discipline
          <select name="discipline" defaultValue={filters?.discipline ?? ""}>
            <option value="">All disciplines</option>
            {COACH_DISCIPLINES.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
          </select>
        </label>
        <label>
          Training place
          <input
            name="location"
            type="search"
            maxLength={160}
            placeholder="Venue or neighbourhood"
            defaultValue={filters?.location ?? ""}
          />
        </label>
        <button className="button dark" type="submit">
          Find sessions
        </button>
        <Link href="/events">Clear filters</Link>
      </form>
      {!filters ? (
        <section className="events-state" role="alert">
          <h2>These filters or page details are invalid</h2>
          <p>
            Choose a discipline and a training place, or return to the first
            page.
          </p>
          <Link href="/events">Reset search</Link>
        </section>
      ) : !page ? (
        <EventsUnavailable href={eventPageHref(filters, filters.after)} />
      ) : (
        <>
          <div className="events-results-heading">
            <h2>
              {filters.after
                ? "More group sessions"
                : "Upcoming group sessions"}
            </h2>
            <span>
              {page.items.length} on this page · Times in Europe/Berlin
            </span>
          </div>
          {page.items.length ? (
            <div className="events-grid">
              {page.items.map((session) => (
                <EventCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <section className="events-state">
              <h3>No upcoming sessions here yet</h3>
              <p>
                Try another discipline or training place. You can also discover
                coaches for a private session.
              </p>
              <div className="events-state-actions">
                <Link href="/events" className="button secondary">
                  Show all group sessions
                </Link>
                <Link href="/explore">Find a coach</Link>
              </div>
            </section>
          )}
          <nav className="events-pagination" aria-label="Group session pages">
            {filters.after && (
              <Link href={eventPageHref(filters, null)}>
                Back to first page
              </Link>
            )}
            {page.nextCursor && (
              <Link
                className="button secondary"
                href={eventPageHref(filters, page.nextCursor)}
              >
                Next sessions →
              </Link>
            )}
          </nav>
        </>
      )}
      <p className="events-footnote">
        A reservation and coach confirmation are separate. Status is shown here
        in MovX; email or push notifications are not provided. For paid
        sessions, the coach collects at the venue. MovX does not collect or
        verify payment.
      </p>
    </div>
  );
}
