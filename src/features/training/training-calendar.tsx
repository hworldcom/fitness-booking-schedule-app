"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkoutEditor } from "./workout-editor";
import { useTrainingWorkspace } from "./use-training-workspace";
import { TrainingFeedback } from "./training-feedback";
import {
  addDays,
  calendarPeriod,
  localDate,
  validTimezone,
  type TrainingCommand,
  type TrainingItem,
  type TrainingPage,
} from "@/training/contracts";

export function TrainingCalendar({
  initial,
  scope,
  date,
  view,
  timezone,
  selected,
}: {
  initial: TrainingPage;
  scope: string;
  date: string;
  view: "week" | "month";
  timezone: string;
  selected?: string;
}) {
  const router = useRouter();
  const workspace = useTrainingWorkspace({
    initial,
    scope,
    date,
    view,
    timezone,
  });
  const { page, busy, error, pending } = workspace;
  const [day, setDay] = useState(
    selected
      ? localDate(
          initial.items.find((i) => i.key === selected)?.startsAt ??
            `${date}T12:00:00Z`,
          timezone,
        )
      : date,
  );
  const [editor, setEditor] = useState<{
    item?: TrainingItem;
    log?: boolean;
    series?: boolean;
  } | null>(null);
  const period = calendarPeriod(date, view);
  const href = (d: string, v = view, tz = timezone) =>
    `/sessions/calendar?date=${d}&view=${v}&timezone=${encodeURIComponent(tz)}`;
  function selectDay(d: string) {
    setDay(d);
    router.replace(href(d), { scroll: false });
  }
  function save(command: TrainingCommand) {
    return workspace.save(command, () => setEditor(null));
  }
  function attendance(item: TrainingItem, value: TrainingItem["attendance"]) {
    void save({
      action: "attendance",
      args: {
        commandId: crypto.randomUUID(),
        key: item.key,
        revision: item.revision,
        attendance: value,
        notes: item.notes,
        intensity: item.intensity,
        actualMinutes: item.actualMinutes,
      },
    });
  }
  if (!workspace.visible)
    return (
      <section role="status">
        <p>Sign in again to load your training.</p>
        <Link href="/sessions/calendar">Reload calendar</Link>
      </section>
    );
  const days = Array.from({ length: view === "month" ? 42 : 7 }, (_, n) =>
    addDays(period.from, n),
  );
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateRanges = new Map(
    page.items.map((i) => [
      i.key,
      [
        dayFormatter.format(new Date(i.startsAt)),
        dayFormatter.format(new Date(Date.parse(i.endsAt) - 1)),
      ],
    ]),
  );
  const onDay = (i: TrainingItem, d: string) =>
    dateRanges.get(i.key)![0] <= d && dateRanges.get(i.key)![1] >= d;
  const time = (i: TrainingItem) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(i.startsAt));
  const agenda = page.items.filter((i) => onDay(i, day));
  return (
    <>
      <section className="training-summary" aria-label="Your training progress">
        <div>
          <span className="eyebrow">KEEP SHOWING UP</span>
          <h2>Your week, your pace.</h2>
          <p>Plan ahead, or log a workout whenever you finish.</p>
        </div>
        <div className="training-count">
          <strong>{page.weekCount}</strong>
          <span>attended this week</span>
        </div>
        <div className="training-count">
          <strong>{page.monthCount}</strong>
          <span>this month</span>
        </div>
      </section>
      <div className="training-actions">
        <button
          className="button secondary"
          onClick={() => setEditor({ log: true })}
        >
          Log workout
        </button>
        <label className="training-preference">
          <input
            type="checkbox"
            checked={page.remindersEnabled}
            disabled={busy}
            onChange={(e) =>
              void save({
                action: "preference",
                args: {
                  commandId: crypto.randomUUID(),
                  enabled: e.target.checked,
                },
              })
            }
          />
          Email me before training
        </label>
      </div>
      <p className="training-help">
        Optional email reminders are sent around one hour before training.
        Delivery can be delayed.
      </p>
      <TrainingFeedback
        workspace={workspace}
        onRetry={() => pending && void save(pending)}
      />
      <section className="training-calendar" aria-label="Training calendar">
        <div className="training-toolbar">
          <div className="training-period">
            <Link
              className="button secondary"
              aria-label="Previous period"
              href={href(period.previous)}
            >
              ←
            </Link>
            <Link
              className="text-link"
              href={href(localDate(new Date(), timezone))}
            >
              Today
            </Link>
            <Link
              className="button secondary"
              aria-label="Next period"
              href={href(period.next)}
            >
              →
            </Link>
          </div>
          <strong>
            {period.from} — {period.through}
          </strong>
          <div className="training-period">
            <Link
              aria-current={view === "week" ? "page" : undefined}
              href={href(date, "week")}
            >
              Week
            </Link>
            <Link
              aria-current={view === "month" ? "page" : undefined}
              href={href(date, "month")}
            >
              Month
            </Link>
          </div>
        </div>
        <form
          className="training-zone"
          onSubmit={(e) => {
            e.preventDefault();
            const tz = String(new FormData(e.currentTarget).get("timezone"));
            if (!validTimezone(tz)) {
              workspace.reportError(
                "Enter a valid timezone, such as Europe/Berlin or UTC.",
              );
              return;
            }
            router.push(href(date, view, tz));
          }}
        >
          <label>
            Display timezone{" "}
            <input
              name="timezone"
              defaultValue={timezone}
              maxLength={80}
              required
            />
          </label>
          <button type="submit">Apply timezone</button>
        </form>
        <div className={`training-grid training-grid-${view}`}>
          {days.map((d) => {
            const items = page.items.filter((i) => onDay(i, d));
            return (
              <div
                key={d}
                className={`training-day ${day === d ? "selected" : ""}`}
              >
                <button
                  className="training-day-heading"
                  aria-pressed={day === d}
                  onClick={() => selectDay(d)}
                >
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${d}T12:00:00Z`))}
                </button>
                {items.slice(0, 3).map((i) => (
                  <button
                    className={`training-event training-event-${i.attendance}`}
                    key={i.key}
                    onClick={() => {
                      selectDay(d);
                      document.getElementById("training-agenda")?.focus();
                    }}
                  >
                    <span>{time(i)}</span>
                    <strong>{i.title}</strong>
                    <small>
                      {i.attendance !== "planned" ? i.attendance : i.state}
                    </small>
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    className="text-link"
                    onClick={() => {
                      selectDay(d);
                      document.getElementById("training-agenda")?.focus();
                    }}
                  >
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {page.next !== null && (
          <div className="training-more">
            <p>
              More training is available in this period. Load it to complete the
              calendar and day counts.
            </p>
            <button disabled={busy} onClick={workspace.loadMore}>
              Load more training
            </button>
          </div>
        )}
      </section>
      <section className="training-agenda" id="training-agenda" tabIndex={-1}>
        <div className="training-agenda-heading">
          <h2>
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "full",
              timeZone: "UTC",
            }).format(new Date(`${day}T12:00:00Z`))}
          </h2>
          <span>{timezone}</span>
        </div>
        {!agenda.length && (
          <div className="training-empty">
            <h3>Room to move.</h3>
            <p>
              No training loaded for this day.{" "}
              <Link href="/sessions/routine">Plan your routine</Link>, log a
              workout, or enjoy a rest day.
            </p>
          </div>
        )}
        {agenda.map((i) => (
          <article className="training-agenda-item" key={i.key}>
            <div className="training-agenda-time">{time(i)}</div>
            <div className="training-agenda-copy">
              <span className="eyebrow">
                {i.source === "personal"
                  ? "YOUR WORKOUT"
                  : i.source === "booking"
                    ? "PRIVATE SESSION"
                    : i.source === "group"
                      ? "GROUP SESSION"
                      : "BOOKING REQUEST"}
              </span>
              <h3>{i.title}</h3>
              <p>
                {i.source !== "personal" && (
                  <>
                    {i.state === "completed"
                      ? "Coach marked complete"
                      : i.state.replaceAll("-", " ")}{" "}
                    ·{" "}
                  </>
                )}
                {i.attendance === "attended"
                  ? "You confirmed attendance"
                  : i.attendance === "planned"
                    ? "Attendance not recorded"
                    : i.attendance}
              </p>
              {i.location && <p>{i.location}</p>}
              {i.notes && <p className="training-notes">{i.notes}</p>}
              {(i.intensity || i.actualMinutes) && (
                <p>
                  {i.intensity ?? "Actual duration"}
                  {i.actualMinutes ? ` · ${i.actualMinutes} minutes` : ""}
                </p>
              )}
              <div className="training-item-actions">
                {i.source === "personal" && i.state === "time-unavailable" && (
                  <>
                    <p>
                      This local time is unavailable because the clocks change.
                      Choose another time.
                    </p>
                    <button onClick={() => setEditor({ item: i })}>
                      Choose workout time
                    </button>
                  </>
                )}
                {i.source !== "request" && i.state !== "time-unavailable" && (
                  <>
                    {Date.parse(i.endsAt) <= Date.parse(page.now) && (
                      <button
                        disabled={busy}
                        onClick={() => attendance(i, "attended")}
                      >
                        I attended
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => attendance(i, "skipped")}
                    >
                      Skipped
                    </button>
                    {i.attendance !== "planned" && (
                      <button
                        disabled={busy}
                        onClick={() => attendance(i, "planned")}
                      >
                        Clear attendance
                      </button>
                    )}
                    <button onClick={() => setEditor({ item: i })}>
                      {i.source === "personal"
                        ? "Edit workout / log"
                        : "Edit personal log"}
                    </button>
                  </>
                )}
                {i.source === "personal" && (
                  <button
                    disabled={busy}
                    onClick={() => attendance(i, "cancelled")}
                  >
                    Cancel workout
                  </button>
                )}
                {i.seriesId &&
                  Date.parse(i.startsAt) > Date.parse(page.now) && (
                    <button
                      onClick={() => setEditor({ item: i, series: true })}
                    >
                      Edit future series
                    </button>
                  )}
                {i.href && (
                  <Link href={i.href}>
                    View{" "}
                    {i.source === "group" ? "group session" : "booking details"}
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
      {editor && (
        <WorkoutEditor
          item={editor.item}
          log={editor.log}
          series={editor.series}
          timezone={timezone}
          busy={busy}
          referenceTime={page.now}
          selectedDay={day}
          error={error}
          onRetry={pending ? () => void save(pending) : undefined}
          onClose={() => setEditor(null)}
          onSave={(command) => void save(command)}
        />
      )}
    </>
  );
}
