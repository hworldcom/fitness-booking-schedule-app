"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { WorkoutEditor } from "./workout-editor";
import { calendarItemPresentation } from "./calendar-item-model";
import {
  trainingItemDateRange,
  weeklyTrainingAgenda,
} from "./calendar-agenda-model";
import { useTrainingWorkspace } from "./use-training-workspace";
import { TrainingFeedback } from "./training-feedback";
import { VideoLinks } from "@/features/notes/video-links";
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
  const { page, busy, error, pending, paused } = workspace;
  const [selection, setSelection] = useState({
    date,
    day: selected
      ? localDate(
          initial.items.find((i) => i.key === selected)?.startsAt ??
            `${date}T12:00:00Z`,
          timezone,
        )
      : date,
  });
  if (selection.date !== date) setSelection({ date, day: date });
  const day = selection.date === date ? selection.day : date;
  const agendaFocus = useRef<string | null>(null);
  const initialAgendaFocus = useRef(false);
  useEffect(() => {
    if (!workspace.visible) {
      agendaFocus.current = null;
      initialAgendaFocus.current = true;
      return;
    }
    if (!initialAgendaFocus.current) {
      initialAgendaFocus.current = true;
      const anchor = window.location.hash.match(
        /^#training-agenda-day-(20\d{2}-\d{2}-\d{2})$/,
      );
      if (anchor) agendaFocus.current = anchor[1];
    }
    if (agendaFocus.current) {
      const target = document.getElementById(
        `training-agenda-day-${agendaFocus.current}`,
      );
      if (target) {
        target.focus();
        agendaFocus.current = null;
      }
    }
  }, [selection, page.items, workspace.visible]);
  const [editor, setEditor] = useState<{
    item?: TrainingItem;
    log?: boolean;
    series?: boolean;
  } | null>(null);
  const period = calendarPeriod(date, view);
  const href = (d: string, v = view, tz = timezone) =>
    `/sessions/calendar?date=${d}&view=${v}&timezone=${encodeURIComponent(tz)}`;
  function selectDay(d: string) {
    setSelection({ date, day: d });
    router.replace(href(d), { scroll: false });
  }
  function showDay(d: string) {
    agendaFocus.current = d;
    setSelection({ date, day: d });
    router.replace(`${href(d)}#training-agenda-day-${d}`, { scroll: false });
  }
  function save(command: TrainingCommand) {
    return workspace.save(command, () => setEditor(null));
  }
  function attendance(item: TrainingItem, value: TrainingItem["attendance"]) {
    if (item.attendance === value) return;
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
  const dateRanges = new Map(
    page.items.map((i) => [i.key, trainingItemDateRange(i, timezone)]),
  );
  const onDay = (i: TrainingItem, d: string) =>
    dateRanges.get(i.key)!.from <= d && dateRanges.get(i.key)!.through >= d;
  const dateLabel = (d: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));
  const time = (i: TrainingItem) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(i.startsAt));
  const agenda = weeklyTrainingAgenda(
    page.items,
    view === "week" ? date : day,
    timezone,
  );
  const agendaDays = agenda.days.filter((group) => group.items.length > 0);
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
          disabled={paused}
          onClick={() => setEditor({ log: true })}
        >
          Log workout
        </button>
        <label className="training-preference">
          <input
            type="checkbox"
            checked={page.remindersEnabled}
            disabled={paused}
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
        <p className="training-help training-calendar-help">
          Select a personal workout to edit its details or log.
        </p>
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
                {items.slice(0, 3).map((i) => {
                  const presentation = calendarItemPresentation(i, page.now);
                  return (
                    <button
                      className={`training-event training-event-${presentation.tone}`}
                      key={i.key}
                      aria-label={
                        i.source === "personal"
                          ? `Edit workout: ${i.title}${presentation.cancelled ? " (Cancelled)" : ""}`
                          : undefined
                      }
                      aria-haspopup={
                        i.source === "personal" ? "dialog" : undefined
                      }
                      disabled={i.source === "personal" && paused}
                      onClick={() => {
                        if (i.source === "personal") setEditor({ item: i });
                        else {
                          showDay(d);
                        }
                      }}
                    >
                      <span>{time(i)}</span>
                      <strong>{i.title}</strong>
                      <small>{presentation.label}</small>
                      {i.source === "personal" && (
                        <span className="training-event-edit">Edit</span>
                      )}
                    </button>
                  );
                })}
                {items.length > 3 && (
                  <button
                    className="text-link"
                    onClick={() => {
                      showDay(d);
                    }}
                  >
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="training-agenda" id="training-agenda" tabIndex={-1}>
        <div className="training-agenda-heading">
          <div>
            <h2>Training for the week</h2>
            <p>
              {dateLabel(agenda.from)} — {dateLabel(agenda.through)}
            </p>
          </div>
          <span>{timezone}</span>
        </div>
        {page.next !== null && (
          <p className="training-agenda-notice" role="status">
            Showing loaded training. Load more below to check for more sessions
            in this period.
          </p>
        )}
        {!agendaDays.length && (
          <div className="training-empty">
            <h3>
              {page.next === null ? "Room to move." : "More training to load"}
            </h3>
            <p>
              No training loaded for this week.{" "}
              {page.next === null && (
                <>
                  <Link href="/sessions/routine">Plan your routine</Link>, log a
                  workout, or enjoy a rest day.
                </>
              )}
            </p>
          </div>
        )}
        {agendaDays.map((group) => (
          <section
            className="training-agenda-day"
            id={`training-agenda-day-${group.date}`}
            key={group.date}
            aria-labelledby={`training-agenda-heading-${group.date}`}
            tabIndex={-1}
          >
            <h3 id={`training-agenda-heading-${group.date}`}>
              {dateLabel(group.date)}
            </h3>
            {group.items.map((i) => {
              const presentation = calendarItemPresentation(i, page.now);
              return (
                <article
                  className={`training-agenda-item${presentation.cancelled ? " training-agenda-item-cancelled" : ""}`}
                  key={i.key}
                >
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
                    <h4>{i.title}</h4>
                    {dateRanges.get(i.key)!.from < group.date && (
                      <p className="training-continuation">
                        Continues from {dateLabel(dateRanges.get(i.key)!.from)}
                      </p>
                    )}
                    <p
                      className={
                        presentation.cancelled
                          ? "training-status-cancelled"
                          : undefined
                      }
                    >
                      {presentation.summary}
                    </p>
                    {presentation.previousAttendance && (
                      <p>{presentation.previousAttendance}</p>
                    )}
                    {i.location && <p>{i.location}</p>}
                    {i.notes && <p className="training-notes">{i.notes}</p>}
                    <VideoLinks videos={i.videos ?? []} />
                    {(i.intensity || i.actualMinutes) && (
                      <p>
                        {i.intensity ?? "Actual duration"}
                        {i.actualMinutes ? ` · ${i.actualMinutes} minutes` : ""}
                      </p>
                    )}
                    <div className="training-item-actions">
                      {i.source === "personal" &&
                        i.state === "time-unavailable" && (
                          <>
                            <p>
                              This local time is unavailable because the clocks
                              change. Choose another time.
                            </p>
                            <button
                              disabled={paused}
                              onClick={() => setEditor({ item: i })}
                            >
                              Choose workout time
                            </button>
                          </>
                        )}
                      {presentation.canSetAttendance && (
                        <div
                          className="training-attendance-actions"
                          role="group"
                          aria-label={`Attendance for ${i.title}`}
                        >
                          {(presentation.canAttend ||
                            i.attendance === "attended") && (
                            <button
                              disabled={paused || i.attendance === "attended"}
                              aria-pressed={i.attendance === "attended"}
                              onClick={() => attendance(i, "attended")}
                            >
                              {i.attendance === "attended" && (
                                <Check size={16} aria-hidden="true" />
                              )}
                              {i.attendance === "attended"
                                ? "Attended"
                                : "I attended"}
                            </button>
                          )}
                          <button
                            className="training-attendance-skipped"
                            disabled={paused || i.attendance === "skipped"}
                            aria-pressed={i.attendance === "skipped"}
                            onClick={() => attendance(i, "skipped")}
                          >
                            {i.attendance === "skipped" && (
                              <Check size={16} aria-hidden="true" />
                            )}
                            Skipped
                          </button>
                          {i.attendance !== "planned" && (
                            <button
                              disabled={paused}
                              onClick={() => attendance(i, "planned")}
                            >
                              Clear attendance
                            </button>
                          )}
                        </div>
                      )}
                      {i.source !== "request" &&
                        i.state !== "time-unavailable" && (
                          <button
                            disabled={paused}
                            onClick={() => setEditor({ item: i })}
                          >
                            {i.source === "personal"
                              ? "Edit workout / log"
                              : "Edit personal log"}
                          </button>
                        )}
                      {presentation.canCancel && (
                        <button
                          disabled={paused}
                          onClick={() => attendance(i, "cancelled")}
                        >
                          Cancel workout
                        </button>
                      )}
                      {i.seriesId &&
                        Date.parse(i.startsAt) > Date.parse(page.now) && (
                          <button
                            disabled={paused}
                            onClick={() => setEditor({ item: i, series: true })}
                          >
                            Edit future series
                          </button>
                        )}
                      {i.href && (
                        <Link href={i.href}>
                          View{" "}
                          {i.source === "group"
                            ? "group session"
                            : "booking details"}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
        {page.next !== null && (
          <div className="training-more">
            <p>
              More training is available in this period. Load it to complete the
              calendar and day counts.
            </p>
            <button disabled={paused} onClick={workspace.loadMore}>
              Load more training
            </button>
          </div>
        )}
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
