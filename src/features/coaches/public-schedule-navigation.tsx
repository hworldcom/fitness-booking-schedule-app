import Link from "next/link";
import "./public-schedule.css";
import {
  publicScheduleHref,
  type publicScheduleSelection,
} from "@/domain/public-coach-schedule";

export function publicScheduleDateLabel(date: string, short = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00Z`));
}

export function PublicScheduleNavigation({
  slug,
  selection,
  counts,
}: {
  slug: string;
  selection: ReturnType<typeof publicScheduleSelection>;
  counts: ReadonlyMap<string, number>;
}) {
  return (
    <div className="public-schedule-navigation">
      <p className="public-schedule-window">
        {publicScheduleDateLabel(selection.today, true)} –{" "}
        {publicScheduleDateLabel(selection.through, true)} · Europe/Berlin
      </p>
      <div className="public-schedule-pages">
        {selection.previous ? (
          <Link
            prefetch={false}
            href={publicScheduleHref(slug, selection.previous)}
          >
            Previous dates
          </Link>
        ) : (
          <span aria-disabled="true">Previous dates</span>
        )}
        <Link prefetch={false} href={publicScheduleHref(slug, selection.today)}>
          Today
        </Link>
        {selection.next ? (
          <Link
            prefetch={false}
            href={publicScheduleHref(slug, selection.next)}
          >
            Next dates
          </Link>
        ) : (
          <span aria-disabled="true">Next dates</span>
        )}
      </div>
      <nav className="public-schedule-dates" aria-label="Private session dates">
        {selection.dates.map((date) => (
          <Link
            key={date}
            prefetch={false}
            href={publicScheduleHref(slug, date)}
            aria-current={date === selection.date ? "date" : undefined}
          >
            <time dateTime={date}>{publicScheduleDateLabel(date, true)}</time>
            <small>
              {counts.get(date) ?? 0} open{" "}
              {(counts.get(date) ?? 0) === 1 ? "hour" : "hours"}
            </small>
          </Link>
        ))}
      </nav>
      <form
        action={`/coaches/${encodeURIComponent(slug)}#private-schedule`}
        className="public-schedule-date-form"
      >
        <label htmlFor="private-session-date">Choose a date</label>
        <input
          key={selection.date}
          id="private-session-date"
          name="date"
          type="date"
          required
          min={selection.today}
          max={selection.through}
          defaultValue={selection.date}
        />
        <button type="submit" className="button secondary">
          Show times
        </button>
      </form>
    </div>
  );
}
