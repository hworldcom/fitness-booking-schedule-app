"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { calendarDate } from "@/domain/coach-calendar";
import type { publicScheduleSelection } from "@/domain/public-coach-schedule";
import {
  publicScheduleDateLabel,
  publicScheduleTimeLabel as scheduleTimeLabel,
} from "./public-schedule-model";
export { publicScheduleTimeLabel as scheduleTimeLabel } from "./public-schedule-model";
import "./seven-day-schedule.css";

export type ScheduleTime = Readonly<{
  id: string;
  startsAt: string;
  endsAt: string;
  venue?: string;
  pending?: boolean;
}>;

export function SevenDaySchedule({
  selection,
  items,
  selectedId,
  onSelect,
  onNavigate,
  status = "ready",
  disabled = false,
  onRetry,
  children,
  duration,
  unselectedCopy = "Choose a class and training place to see available times.",
}: {
  selection: ReturnType<typeof publicScheduleSelection>;
  items: readonly ScheduleTime[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNavigate: (date: string) => void;
  status?: "ready" | "loading" | "unavailable" | "unselected";
  disabled?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
  duration?: number;
  unselectedCopy?: string;
}) {
  const heading = useRef<HTMLParagraphElement>(null);
  const count = new Set(items.map((item) => item.startsAt)).size;
  const navigate = (date: string) => {
    onNavigate(date);
    heading.current?.focus({ preventScroll: true });
  };
  return (
    <div className="seven-day-schedule" aria-busy={status === "loading"}>
      <header className="seven-day-heading">
        <div>
          <span className="eyebrow">PRIVATE SESSIONS</span>
          <h2>Make time for your next step.</h2>
          <p>
            Your next seven days, all in one view. Choose a time that works for
            you.
          </p>
        </div>
        <p className="seven-day-total" role="status">
          <strong>{status === "ready" ? count : "—"}</strong>
          <span>
            {status === "ready" ? (
              <>
                available starts
                <br />
                in these {selection.dates.length} days
              </>
            ) : status === "loading" ? (
              "Checking availability…"
            ) : (
              "Availability not loaded"
            )}
          </span>
        </p>
      </header>
      {children}
      <div className="seven-day-toolbar">
        <div>
          <p className="seven-day-range" ref={heading} tabIndex={-1}>
            {publicScheduleDateLabel(selection.dates[0], true)} –{" "}
            {publicScheduleDateLabel(selection.dates.at(-1)!, true)}
          </p>
          <p className="seven-day-timezone">
            <Clock3 size={13} aria-hidden="true" /> Berlin time
            {duration ? ` · ${duration}-minute sessions` : ""}
          </p>
        </div>
        <div
          className="seven-day-pages"
          role="group"
          aria-label="Browse private session weeks"
        >
          <button
            type="button"
            disabled={disabled || !selection.previous}
            onClick={() => selection.previous && navigate(selection.previous)}
          >
            <ChevronLeft size={14} aria-hidden="true" /> Previous 7 days
          </button>
          <button
            type="button"
            className="seven-day-today"
            disabled={disabled || selection.dates[0] === selection.today}
            onClick={() => navigate(selection.today)}
          >
            This week
          </button>
          <button
            type="button"
            disabled={disabled || !selection.next}
            onClick={() => selection.next && navigate(selection.next)}
          >
            Next 7 days <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {status === "loading" ? (
        <p className="seven-day-state" role="status">
          Checking the week’s available times…
        </p>
      ) : status === "unavailable" ? (
        <div className="seven-day-state" role="status">
          <h3>We couldn’t load the times</h3>
          <p>
            Availability couldn’t be verified. Your class and place stay
            selected.
          </p>
          <button
            type="button"
            className="button dark"
            onClick={onRetry}
            disabled={disabled}
          >
            Try again
          </button>
        </div>
      ) : status === "unselected" ? (
        <p className="seven-day-state" role="status">
          {unselectedCopy}
        </p>
      ) : count === 0 ? (
        <div className="seven-day-state" role="status">
          <h3>No times in this week</h3>
          <p>Try another class, training place or the next seven days.</p>
          {selection.next && (
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => navigate(selection.next!)}
            >
              See next 7 days <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div
          className="seven-day-grid"
          role="group"
          aria-label="Bookable times by day"
        >
          {selection.dates.map((date) => {
            const times = items.filter(
              (item) => calendarDate(item.startsAt) === date,
            );
            const dayCount = new Set(times.map((item) => item.startsAt)).size;
            const clockInstants = new Map<string, Set<number>>();
            for (const time of times) {
              const label = scheduleTimeLabel(time.startsAt);
              const instants = clockInstants.get(label) ?? new Set<number>();
              instants.add(Date.parse(time.startsAt));
              clockInstants.set(label, instants);
            }
            const repeated = (value: string) =>
              (clockInstants.get(scheduleTimeLabel(value))?.size ?? 0) > 1;
            return (
              <section
                className={`seven-day-card${date === selection.today ? " is-today" : ""}`}
                key={date}
                aria-label={publicScheduleDateLabel(date)}
              >
                <header>
                  <div>
                    <span>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "UTC",
                        weekday: "short",
                      }).format(new Date(`${date}T12:00:00Z`))}
                    </span>
                    {date === selection.today && <small>Today</small>}
                  </div>
                  <h3>
                    <time dateTime={date}>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "UTC",
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${date}T12:00:00Z`))}
                    </time>
                  </h3>
                  <p>
                    {dayCount} {dayCount === 1 ? "start" : "starts"} available
                  </p>
                </header>
                {times.length ? (
                  <div className="seven-day-times">
                    {times.map((time) => (
                      <button
                        type="button"
                        key={time.id}
                        className={
                          repeated(time.startsAt)
                            ? "is-ambiguous-time"
                            : undefined
                        }
                        disabled={disabled}
                        aria-pressed={selectedId === time.id}
                        aria-label={`${publicScheduleDateLabel(date, true)}, ${scheduleTimeLabel(time.startsAt, true)} to ${scheduleTimeLabel(time.endsAt, true)}${time.venue ? `, ${time.venue}` : ""}${time.pending ? ", awaiting coach confirmation" : ""}`}
                        onClick={() => onSelect(time.id)}
                      >
                        <span>
                          {scheduleTimeLabel(
                            time.startsAt,
                            repeated(time.startsAt),
                          )}
                        </span>
                        {time.venue && <small>{time.venue}</small>}
                        {time.pending && <small>Requested</small>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="seven-day-empty">
                    No private sessions available
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="seven-day-caption">
        <span>
          Start times are alternatives. A request needs coach confirmation.
        </span>
        <span>
          Dates {selection.dates[0]} – {selection.dates.at(-1)} · up to 30 days
          ahead
        </span>
      </p>
    </div>
  );
}
