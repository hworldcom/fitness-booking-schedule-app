import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { COACH_DISCIPLINES } from "@/domain/coaches";
import {
  eventPageHref,
  type EventSearch,
} from "@/features/events/event-contract";
import { EventsUnavailable } from "@/features/events/event-ui";
import { MarketplaceHero } from "@/features/public/marketplace-hero";
import { publicEventDirectory } from "@/server/group-sessions/directory-service";
import {
  eventDirectoryHref,
  parseEventDirectory,
} from "@/features/events/directory-contract";
import { EventResults } from "@/features/events/event-results";
import eventsBackground from "../../../public/images/events-tug-of-war.jpg";
import "@/features/events/events.css";
import "@/features/events/event-directory.css";

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
  const directory = parseEventDirectory(await searchParams);
  const filters = directory?.filters;
  const result = filters ? await publicEventDirectory(filters) : null;
  return (
    <div className="events-page events-discovery-page">
      <MarketplaceHero
        image={eventsBackground}
        alt="Lower-body view of a group tug-of-war on a grass field."
        titleId="events-hero-title"
        className="marketplace-events-hero"
        imageFrameClassName="marketplace-events-image-frame"
        sizes="(max-width: 480px) 480px, 100vw"
      >
        <span>Find your small group session.</span> <span>Train together.</span>
      </MarketplaceHero>
      <div className="home-marketplace-search events-marketplace-search">
        <form
          key={filters ? eventPageHref(filters, null) : "invalid-filters"}
          action="/events"
          method="get"
          className="home-coach-search events-coach-search"
          aria-label="Filter group sessions"
        >
          {directory?.explicitView && (
            <input type="hidden" name="view" value={directory.view} />
          )}
          {filters?.sessionTypeId && (
            <input
              type="hidden"
              name="sessionType"
              value={filters.sessionTypeId}
            />
          )}
          <label>
            <span>Discipline</span>
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
            <span>Training place</span>
            <input
              name="location"
              type="search"
              maxLength={160}
              placeholder="Venue or neighbourhood"
              defaultValue={filters?.location ?? ""}
            />
          </label>
          <button
            className="button dark"
            type="submit"
            aria-label="Find sessions"
          >
            <Search size={17} aria-hidden="true" /> <span>Find sessions</span>
          </button>
        </form>
        <nav
          className="events-directory-navigation"
          aria-label="Group session navigation"
        >
          <Link href="/events">Clear filters</Link>
          <Link href="/sessions/groups">My group sessions →</Link>
        </nav>
        {filters?.sessionTypeId && (
          <p className="events-session-type-notice">
            Showing this coach’s session type.{" "}
            <Link href="/events">Show all group sessions</Link>
          </p>
        )}
      </div>
      <div className="events-discovery-content">
        {!filters ? (
          <section className="events-state" role="alert">
            <h2>These filters or page details are invalid</h2>
            <p>
              Choose a discipline and a training place, or return to the first
              page.
            </p>
            <Link href="/events">Reset search</Link>
          </section>
        ) : !directory || result?.status !== "ready" ? (
          <EventsUnavailable
            href={eventDirectoryHref(
              filters,
              filters.after,
              directory?.explicitView ? directory.view : undefined,
            )}
          />
        ) : (
          <EventResults
            key={eventPageHref(filters, filters.after)}
            initial={result}
            directory={directory}
          />
        )}
        <p className="events-footnote">
          A reservation and coach confirmation are separate. Status is shown
          here in MovX; email or push notifications are not provided. For paid
          sessions, the coach collects at the venue. MovX does not collect or
          verify payment.
        </p>
      </div>
    </div>
  );
}
