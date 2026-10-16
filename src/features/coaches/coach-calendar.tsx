"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  UsersRound,
} from "lucide-react";
import {
  addCalendarDays,
  calendarDate,
  calendarDates,
  calendarHref,
  calendarItemKey,
  calendarPeriod,
  calendarStatusLabel,
  itemOnCalendarDate,
  mergeCalendarItems,
  type CalendarItem,
  type CalendarSelection,
} from "@/domain/coach-calendar";
import { availabilityHref } from "./availability-editor-model";
import { AvailabilityDialog } from "./availability-editor-controls";
import {
  calendarDetailHref,
  calendarItemRange,
  calendarLanes,
  calendarMinutes,
  type CoachCalendarData,
  type CoachCalendarLoader,
} from "./coach-calendar-model";
import "./availability-editor.css";
import "./coach-calendar.css";

const dayLabel = (date: string, long = false) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
const kindLabel = (item: CalendarItem) =>
  item.source === "group"
    ? "Group"
    : item.source === "booking"
      ? "Private session"
      : "Private availability";
const itemLabel = (item: CalendarItem, now: string) =>
  `${kindLabel(item)}: ${item.title}, ${dayLabel(calendarDate(item.startsAt))} ${calendarItemRange(item)}, ${item.venueName}, ${calendarStatusLabel(item, now)}${item.pendingCount ? `, ${item.pendingCount} pending requests` : ""}`;

function CalendarItemButton({
  item,
  now,
  compact = false,
  onSelect,
  date,
}: {
  item: CalendarItem;
  now: string;
  compact?: boolean;
  onSelect: (item: CalendarItem) => void;
  date?: string;
}) {
  return (
    <button
      type="button"
      className={`coach-calendar-item ${item.source} ${item.status}${compact ? " compact" : ""}`}
      aria-label={itemLabel(item, now)}
      onClick={() => onSelect(item)}
    >
      <span className="coach-calendar-item-time">
        {calendarItemRange(item, compact ? date : undefined)}
      </span>
      <strong>{item.title}</strong>
      <span className="coach-calendar-item-status">
        {kindLabel(item)} · {calendarStatusLabel(item, now)}
      </span>
      {!compact && (
        <>
          <span className="coach-calendar-item-venue">
            <MapPin size={12} />
            {item.venueName}
            {!item.venueActive && (
              <em>
                {item.locationId ? " · Inactive venue" : " · Historical venue"}
              </em>
            )}
          </span>
          {item.pendingCount > 0 && (
            <span className="coach-calendar-pending">
              <UsersRound size={12} />
              {item.pendingCount} pending · time is still open
            </span>
          )}
        </>
      )}
    </button>
  );
}
function TimedCalendar({
  data,
  dates,
  selection,
  onSelect,
}: {
  data: CoachCalendarData;
  dates: readonly string[];
  selection: CalendarSelection;
  onSelect: (item: CalendarItem) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7 * 64;
  }, []);
  const today = calendarDate(data.page.now);
  return (
    <div
      className="coach-calendar-timed"
      aria-label={`${selection.view} timed calendar`}
    >
      <div
        className="coach-calendar-timed-heading"
        style={{
          gridTemplateColumns: `48px repeat(${dates.length},minmax(0,1fr))`,
        }}
      >
        <span>BERLIN</span>
        {dates.map((date) => (
          <Link
            key={date}
            className={date === today ? "today" : ""}
            href={calendarHref({ ...selection, date, view: "day" })}
          >
            <span>
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(`${date}T12:00:00Z`))}
            </span>
            <strong>{Number(date.slice(8))}</strong>
          </Link>
        ))}
      </div>
      <div className="coach-calendar-timed-scroll" ref={scroll}>
        <div
          className="coach-calendar-timed-body"
          style={{
            gridTemplateColumns: `48px repeat(${dates.length},minmax(0,1fr))`,
          }}
        >
          <div className="coach-calendar-hours" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * 64 }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dates.map((date) => (
            <div
              key={date}
              className={`coach-calendar-day-column${date === today ? " today" : ""}`}
            >
              {data.mayEditAvailability && (
                <Link
                  className="coach-calendar-empty-date"
                  href={availabilityHref(date)}
                  aria-label={`Edit availability for ${dayLabel(date, true)}`}
                />
              )}
              {calendarLanes(
                data.page.items.filter((item) =>
                  itemOnCalendarDate(item, date),
                ),
                date,
              ).map((entry) => (
                <div
                  key={calendarItemKey(entry.item)}
                  className="coach-calendar-timed-event"
                  style={{
                    top: (entry.start / 60) * 64,
                    height: Math.max(
                      30,
                      ((entry.end - entry.start) / 60) * 64 - 3,
                    ),
                    left: `${(entry.lane / entry.lanes) * 100}%`,
                    width: `${100 / entry.lanes}%`,
                  }}
                >
                  <CalendarItemButton
                    item={entry.item}
                    now={data.page.now}
                    compact
                    date={date}
                    onSelect={onSelect}
                  />
                </div>
              ))}
              {date === today && (
                <div
                  className="coach-calendar-now"
                  style={{
                    top: (calendarMinutes(data.page.now, date) / 60) * 64,
                  }}
                  aria-label={`Current Berlin time ${timeLabel(data.page.now)}`}
                >
                  <span />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="coach-calendar-grid-help">
        The agenda below includes every loaded item with its full venue and
        status.
      </p>
    </div>
  );
}
export function CoachCalendar({
  initial,
  selection,
  load,
}: {
  initial: CoachCalendarData;
  selection: CalendarSelection;
  load: CoachCalendarLoader;
}) {
  const [data, setData] = useState<CoachCalendarData | null>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const period = calendarPeriod(selection);
  const dates = calendarDates(period.from, period.through);
  async function read(more = false) {
    if (busy || !data) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await load(
        { ...initial.query, after: more ? data.page.nextCursor : null },
        initial.scope,
      );
      if (result.status === "denied") {
        setData(null);
        setSelected(null);
      } else if (result.status !== "ready") setMessage(result.message);
      else if (more && result.data.page.version !== data.page.version) {
        setStale(true);
        setSelected(null);
        setMessage(
          "The calendar changed while you were browsing. Reload this period before continuing.",
        );
      } else {
        setData({
          ...result.data,
          page: {
            ...result.data.page,
            items: more
              ? mergeCalendarItems(data.page.items, result.data.page.items)
              : result.data.page.items,
          },
        });
        setStale(false);
        setSelected(null);
      }
    } catch {
      setMessage(
        "The calendar could not be verified. Retry the same period; no empty schedule is assumed.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="coach-calendar-unavailable" role="alert">
        <h2>Calendar access changed</h2>
        <p>
          Private calendar data has been cleared. Reload with an authorized
          coach account.
        </p>
        <Link className="button secondary" href="/coach">
          Reload workspace
        </Link>
      </section>
    );
  const today = calendarDate(data.page.now);
  const throughHorizon = addCalendarDays(today, 29);
  const rangeTitle =
    selection.view === "month"
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "UTC",
          month: "long",
          year: "numeric",
        }).format(new Date(`${selection.date}T12:00:00Z`))
      : selection.view === "day"
        ? `${dayLabel(selection.date, true)} ${selection.date.slice(0, 4)}`
        : `${dayLabel(period.from)} – ${dayLabel(period.through)} ${period.through.slice(0, 4)}`;
  return (
    <section
      className="coach-calendar"
      aria-label="Coach calendar"
      aria-busy={busy}
    >
      <header className="coach-calendar-heading">
        <div>
          <span className="eyebrow">YOUR SCHEDULE</span>
          <h2>Calendar</h2>
          <p>Private training and group sessions, together.</p>
        </div>
        <span className="coach-calendar-timezone">
          <Clock3 size={15} />
          Europe/Berlin
        </span>
      </header>
      <div className="coach-calendar-toolbar">
        <div className="coach-calendar-period-controls">
          <Link
            className="button secondary"
            href={calendarHref({ ...selection, date: today })}
          >
            Today
          </Link>
          <Link
            className="coach-calendar-arrow"
            aria-label="Previous calendar period"
            href={calendarHref({ ...selection, date: period.previous })}
          >
            <ArrowLeft size={18} />
          </Link>
          <Link
            className="coach-calendar-arrow"
            aria-label="Next calendar period"
            href={calendarHref({ ...selection, date: period.next })}
          >
            <ArrowRight size={18} />
          </Link>
          <h3 aria-live="polite">{rangeTitle}</h3>
        </div>
        <nav
          className="coach-calendar-view-controls"
          aria-label="Calendar views"
        >
          {(["day", "week", "month"] as const).map((view) => (
            <Link
              key={view}
              aria-current={selection.view === view ? "page" : undefined}
              href={calendarHref({ ...selection, view })}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="coach-calendar-filters">
        <nav aria-label="Session type filters">
          {(["all", "private", "group"] as const).map((type) => (
            <Link
              key={type}
              aria-current={selection.type === type ? "page" : undefined}
              href={calendarHref({ ...selection, type })}
            >
              {type === "all"
                ? "All sessions"
                : type === "private"
                  ? "Private"
                  : "Group"}
            </Link>
          ))}
        </nav>
        <form action="/coach" method="get">
          <input type="hidden" name="view" value="schedule" />
          <input type="hidden" name="section" value="calendar" />
          <input type="hidden" name="date" value={selection.date} />
          <input type="hidden" name="calendarView" value={selection.view} />
          <input type="hidden" name="type" value={selection.type} />
          <label className="coach-calendar-venue-filter">
            <MapPin size={14} />
            <span className="sr-only">Calendar venue</span>
            <select
              name="venue"
              aria-label="Calendar venue"
              defaultValue={selection.venueId ?? ""}
            >
              <option value="">All venues</option>
              {!data.locations.some((l) => l.id === selection.venueId) &&
                selection.venueId && (
                  <option value={selection.venueId}>Unavailable venue</option>
                )}
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.publicName}
                  {l.status === "inactive" ? " (Inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="coach-calendar-history">
            <input
              name="history"
              type="checkbox"
              value="1"
              defaultChecked={selection.history}
            />
            Show cancelled / withdrawn
          </label>
          <button className="coach-calendar-apply" type="submit">
            Apply filters
          </button>
        </form>
      </div>
      <div className="coach-calendar-summary">
        <p>
          <span className="coach-calendar-dot available" />
          Available <span className="coach-calendar-dot booking" />
          Private session <span className="coach-calendar-dot group" />
          Group
        </p>
        <button type="button" disabled={busy} onClick={() => void read()}>
          Reload calendar
        </button>
      </div>
      {message && (
        <p
          className="coach-calendar-feedback"
          ref={feedback}
          tabIndex={-1}
          role="alert"
        >
          {message}
        </p>
      )}
      {!data.mayEditAvailability && (
        <p className="coach-calendar-feedback">
          Existing sessions and history are available. Availability publishing
          is paused.
        </p>
      )}
      {!stale && (
        <>
          {selection.view === "month" ? (
            <div
              className="coach-calendar-month"
              role="group"
              aria-label={rangeTitle}
            >
              <div className="coach-calendar-month-weekdays" aria-hidden="true">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="coach-calendar-month-days">
                {dates.map((date) => {
                  const day = data.page.days.find((d) => d.date === date);
                  return (
                    <section
                      key={date}
                      className={`coach-calendar-month-day${date.slice(0, 7) !== selection.date.slice(0, 7) ? " adjacent" : ""}${date === today ? " today" : ""}`}
                      aria-label={dayLabel(date, true)}
                    >
                      <header>
                        <Link
                          href={calendarHref({
                            ...selection,
                            date,
                            view: "day",
                          })}
                          aria-label={`Open ${dayLabel(date, true)}`}
                        >
                          {Number(date.slice(8))}
                        </Link>
                        {data.mayEditAvailability && (
                          <Link
                            href={availabilityHref(date)}
                            aria-label={`Edit availability for ${dayLabel(date, true)}`}
                          >
                            <Plus size={13} />
                          </Link>
                        )}
                      </header>
                      <div>
                        {day?.previews.map((item) => (
                          <CalendarItemButton
                            key={calendarItemKey(item)}
                            item={item}
                            now={data.page.now}
                            compact
                            date={date}
                            onSelect={setSelected}
                          />
                        ))}
                      </div>
                      {day && day.total > day.previews.length && (
                        <Link
                          className="coach-calendar-more"
                          href={calendarHref({
                            ...selection,
                            date,
                            view: "day",
                          })}
                          aria-label={`Show all ${day.total} items on ${dayLabel(date, true)}`}
                        >
                          +{day.total - day.previews.length} more
                        </Link>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <TimedCalendar
              data={data}
              dates={dates}
              selection={selection}
              onSelect={setSelected}
            />
          )}
          <section
            className="coach-calendar-agenda"
            aria-label="Calendar agenda"
          >
            <header>
              <div>
                <h3>
                  {selection.view === "day" ? "Day agenda" : "Period agenda"}
                </h3>
                <p>
                  {data.page.items.length} of {data.page.total} times and
                  sessions shown
                </p>
              </div>
              <CalendarDays size={21} />
            </header>
            {data.page.total === 0 ? (
              <div className="coach-calendar-empty">
                <CalendarDays size={28} />
                <h3>No matching times or sessions</h3>
                <p>Try another period or change the filters.</p>
                {data.mayEditAvailability && (
                  <Link
                    className="button secondary"
                    href={availabilityHref(selection.date)}
                  >
                    Edit this date’s availability
                  </Link>
                )}
              </div>
            ) : (
              dates.map((date) => {
                const items = data.page.items.filter((item) =>
                  itemOnCalendarDate(item, date),
                );
                return (
                  items.length > 0 && (
                    <section
                      className="coach-calendar-agenda-day"
                      key={date}
                      aria-label={`${dayLabel(date, true)} agenda`}
                    >
                      <h4>
                        <span>{dayLabel(date, true)}</span>
                        {date === today && <small>Today</small>}
                      </h4>
                      <div>
                        {items.map((item) => (
                          <CalendarItemButton
                            key={calendarItemKey(item)}
                            item={item}
                            now={data.page.now}
                            onSelect={setSelected}
                          />
                        ))}
                      </div>
                    </section>
                  )
                );
              })
            )}
            {data.page.nextCursor && (
              <div className="coach-calendar-page-controls">
                <p>More items are available in this period.</p>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void read(true)}
                >
                  {busy ? "Loading…" : "Load more calendar items"}
                </button>
              </div>
            )}
          </section>
        </>
      )}
      <p className="coach-calendar-horizon">
        Private availability: {dayLabel(today)} through{" "}
        {dayLabel(throughHorizon)}. Existing sessions and independently
        scheduled groups can appear outside this window.
      </p>
      {selected && (
        <AvailabilityDialog
          title={selected.title}
          onClose={() => setSelected(null)}
        >
          <div className="coach-calendar-detail">
            <span className={`coach-calendar-detail-status ${selected.status}`}>
              {kindLabel(selected)} ·{" "}
              {calendarStatusLabel(selected, data.page.now)}
            </span>
            <p>
              <Clock3 size={16} />
              {dayLabel(calendarDate(selected.startsAt), true)} ·{" "}
              {calendarItemRange(selected)} · Europe/Berlin
            </p>
            <p>
              <MapPin size={16} />
              <span>
                {selected.venueName}
                <small>
                  {selected.venueLabel}
                  {!selected.venueActive
                    ? " · Historical / inactive venue"
                    : ""}
                </small>
              </span>
            </p>
            {selected.pendingCount > 0 && (
              <p>
                {selected.pendingCount} pending request
                {selected.pendingCount === 1 ? "" : "s"}. The time is open until
                a coach confirms one athlete.
              </p>
            )}
            {selected.source === "group" && selected.status === "open" && (
              <p>
                This group reserves your time and is awaiting coach
                confirmation.
              </p>
            )}
            {selected.source === "booking" &&
              selected.status === "confirmed" &&
              Date.parse(selected.endsAt) < Date.parse(data.page.now) && (
                <p>
                  This booking remains Confirmed until you explicitly complete
                  it in Bookings.
                </p>
              )}
          </div>
          <div className="availability-dialog-actions">
            <Link
              className="button secondary"
              href={calendarDetailHref(selected)}
            >
              {selected.source === "group"
                ? "View published session"
                : selected.source === "booking"
                  ? "View original booking"
                  : "View booking requests"}
            </Link>
            {data.mayEditAvailability && selected.source === "availability" && (
              <Link
                className="button dark"
                href={availabilityHref(calendarDate(selected.startsAt))}
              >
                Edit date hours
              </Link>
            )}
          </div>
        </AvailabilityDialog>
      )}
    </section>
  );
}
