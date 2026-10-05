import type { Metadata } from "next";
import Link from "next/link";
import { GroupEventCatalogue } from "@/features/group-events/group-event-catalogue";
import { publicGroupEventCatalogue } from "@/server/group-events/service";

export const metadata: Metadata = { title: "Group events" };

export default async function Page() {
  let events = null;
  try {
    events = await publicGroupEventCatalogue();
  } catch {
    events = null;
  }
  if (events === null) {
    return (
      <section className="group-events-empty" role="alert">
        <span className="eyebrow">GROUP EVENTS UNAVAILABLE</span>
        <h1>We couldn’t load verified event pools.</h1>
        <p>No stale funding state or wallet controls were shown.</p>
        <Link className="button secondary" href="/events">
          Try again
        </Link>
      </section>
    );
  }
  return (
    <div className="group-events-page">
      <header className="group-events-header">
        <span className="eyebrow">GROUP-FUNDED TRAINING</span>
        <h1>
          Fund the class together<span className="lime-text">.</span>
        </h1>
        <p>
          One fixed test-EURC price, a visible minimum and a deadline. If the
          group reaches its threshold, the coach can claim the pool; if it does
          not, every participant can claim their own full refund.
        </p>
      </header>
      <GroupEventCatalogue events={events} />
    </div>
  );
}
