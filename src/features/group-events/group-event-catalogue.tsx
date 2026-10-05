import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { formatEurcBaseUnits } from "@/domain/coach-marketplace";
import { groupEventProgress } from "@/domain/group-event-marketplace";
import type { GroupEventProjection } from "@/domain/group-events";

function eventDate(event: GroupEventProjection) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: event.location.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
}

export function GroupEventCatalogue({
  events,
}: {
  events: readonly GroupEventProjection[];
}) {
  if (events.length === 0) {
    return (
      <section className="group-events-empty">
        <span className="eyebrow">GROUP-FUNDED TRAINING</span>
        <h2>No published group events yet.</h2>
        <p>
          Coaches can prepare an event pool from their workspace. Only events
          whose on-chain terms have been finalized and verified appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="group-event-grid">
      {events.map((event) => {
        const progress = groupEventProgress(event);
        return (
          <article className="group-event-card" key={event.id}>
            <div className="group-event-card-topline">
              <span>{event.discipline}</span>
              <span>{event.pool?.lifecycleStatus ?? "Unavailable"}</span>
            </div>
            <h2>{event.title}</h2>
            <p className="group-event-coach">with {event.coach.displayName}</p>
            <dl className="group-event-card-facts">
              <div>
                <dt>
                  <CalendarDays size={15} aria-hidden="true" /> When
                </dt>
                <dd>{eventDate(event)}</dd>
              </div>
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" /> Where
                </dt>
                <dd>{event.location.label}</dd>
              </div>
              <div>
                <dt>
                  <Users size={15} aria-hidden="true" /> Funding
                </dt>
                <dd>{progress.label}</dd>
              </div>
            </dl>
            {event.pool ? (
              <>
                <div
                  className="group-event-progress"
                  role="progressbar"
                  aria-label="Minimum funding progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                >
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="group-event-price">
                  {formatEurcBaseUnits(
                    event.pool.seatPriceBaseUnits.toString(),
                  )}{" "}
                  test EURC <small>for one conditional seat</small>
                </p>
              </>
            ) : (
              <p className="group-event-unavailable">
                Verified pool state is temporarily unavailable.
              </p>
            )}
            <Link
              className="group-event-card-link"
              href={`/events/${event.slug}`}
            >
              View event and funding terms{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
