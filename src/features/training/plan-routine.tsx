"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import {
  calendarPeriod,
  localDate,
  validDate,
  validTimezone,
  type TrainingCommand,
  type TrainingItem,
  type TrainingPage,
} from "@/training/contracts";
import { nextRoutineDate, routineDays, routineHref } from "./routine-model";
import { useTrainingWorkspace } from "./use-training-workspace";
import { TrainingFeedback } from "./training-feedback";
import { WorkoutEditor } from "./workout-editor";
import "./plan-routine.css";

export function PlanRoutine({
  initial,
  scope,
  date,
  timezone,
}: {
  initial: TrainingPage;
  scope: string;
  date: string;
  timezone: string;
}) {
  const router = useRouter();
  const workspace = useTrainingWorkspace({
    initial,
    scope,
    date,
    view: "week",
    timezone,
  });
  const { page, busy, pending, error } = workspace;
  const [editor, setEditor] = useState<{
    date: string;
    item?: TrainingItem;
    weekly: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState<TrainingItem | null>(null);
  const period = calendarPeriod(date, "week");
  const paused = busy || !!pending;
  function save(command: TrainingCommand) {
    return workspace.save(command, () => {
      setEditor(null);
      setRemoving(null);
      const day = command.args.date,
        zone = command.args.timezone;
      if (
        validDate(day) &&
        validTimezone(zone) &&
        (day < period.from || day > period.through || zone !== timezone)
      )
        router.push(routineHref(day, zone));
    });
  }
  if (!workspace.visible)
    return (
      <section role="status">
        <p>Sign in again to load your training.</p>
        <Link href="/sessions/routine">Reload routine</Link>
      </section>
    );
  const days = routineDays(date, page.items, timezone);
  const dateLabel = (day: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  return (
    <section className="routine-planner" aria-label="Routine planner">
      <header className="routine-heading">
        <div>
          <span className="eyebrow">YOUR NORMAL WEEK</span>
          <h2>Plan routine</h2>
          <p>Make room for the workouts you want to keep showing up for.</p>
        </div>
        <span className="routine-timezone">
          <Clock3 size={15} aria-hidden="true" />
          {timezone}
        </span>
      </header>
      <div className="routine-toolbar">
        <nav className="routine-period" aria-label="Routine week">
          <Link
            href={routineHref(period.previous, timezone)}
            aria-label="Previous routine week"
            aria-disabled={paused || undefined}
            onClick={(e) => {
              if (paused) e.preventDefault();
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <strong>
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })
              .formatRange(
                new Date(`${period.from}T12:00:00Z`),
                new Date(`${period.through}T12:00:00Z`),
              )
              .replace(/\s/g, " ")}
          </strong>
          <Link
            href={routineHref(period.next, timezone)}
            aria-label="Next routine week"
            aria-disabled={paused || undefined}
            onClick={(e) => {
              if (paused) e.preventDefault();
            }}
          >
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
        <button
          className="routine-text-button"
          disabled={paused}
          onClick={workspace.refresh}
        >
          Reload saved version
        </button>
      </div>
      <form
        className="routine-settings"
        onSubmit={(event) => {
          event.preventDefault();
          if (paused) return;
          const values = new FormData(event.currentTarget),
            day = values.get("date"),
            zone = values.get("timezone");
          if (!validDate(day) || !validTimezone(zone)) {
            workspace.reportError(
              "Choose a valid date and timezone, such as Europe/Berlin or UTC.",
            );
            return;
          }
          workspace.reportError("");
          router.push(routineHref(day, zone));
        }}
      >
        <label>
          Week containing
          <input
            type="date"
            name="date"
            defaultValue={date}
            required
            disabled={paused}
          />
        </label>
        <label>
          Display timezone
          <input
            name="timezone"
            defaultValue={timezone}
            required
            maxLength={80}
            disabled={paused}
          />
        </label>
        <button className="button secondary" disabled={paused}>
          Apply week
        </button>
      </form>
      <TrainingFeedback
        workspace={workspace}
        onRetry={() => pending && void save(pending)}
      />
      <div className="routine-week-card">
        <div className="routine-card-intro">
          <h3>Your training week</h3>
          <p>
            Add a workout to a day to start a weekly routine. You can also turn
            off Repeat weekly for a single workout.
          </p>
          <p>
            Planned personal workouts are shown for this week. Logs, attendance
            and individual changes are in{" "}
            <Link href="/sessions/calendar">Calendar</Link>.
          </p>
        </div>
        {days.map((day) => {
          const weekday = new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            timeZone: "UTC",
          }).format(new Date(`${day.date}T12:00:00Z`));
          const startDate = nextRoutineDate(day.date, page.now, timezone);
          return (
            <section
              className="routine-day"
              aria-label={weekday}
              key={day.date}
            >
              <div className="routine-day-label">
                <strong>{weekday}</strong>
                <span>{dateLabel(day.date)}</span>
              </div>
              <div className="routine-workouts">
                {!day.items.length && (
                  <p className="routine-off">
                    {page.next !== null
                      ? "No workouts loaded for this day yet"
                      : "No workouts planned"}
                  </p>
                )}
                {day.items.map((item) => (
                  <article className="routine-workout" key={item.key}>
                    <div>
                      <h4>{item.title}</h4>
                      <p>
                        {time(item.startsAt)}–{time(item.endsAt)} ·{" "}
                        {Math.round(
                          (Date.parse(item.endsAt) -
                            Date.parse(item.startsAt)) /
                            60000,
                        )}{" "}
                        minutes
                      </p>
                      <span>
                        {item.seriesId ? "Repeats weekly" : "One date only"}
                        {item.timezone !== timezone
                          ? ` · ${item.timezone}`
                          : ""}
                      </span>
                      {item.state === "time-unavailable" && (
                        <p>
                          This time needs updating because the clocks change.
                          Choose another time in Calendar.
                        </p>
                      )}
                    </div>
                    <div className="routine-workout-actions">
                      {Date.parse(item.startsAt) > Date.parse(page.now) &&
                        item.state !== "time-unavailable" && (
                          <button
                            className="routine-text-button"
                            disabled={paused}
                            onClick={() =>
                              setEditor({
                                date: localDate(item.startsAt, item.timezone),
                                item,
                                weekly: !!item.seriesId,
                              })
                            }
                          >
                            {item.seriesId ? "Edit routine" : "Edit workout"}
                          </button>
                        )}
                      {(!!item.seriesId ||
                        Date.parse(item.startsAt) > Date.parse(page.now)) && (
                        <button
                          className="routine-text-button routine-remove"
                          disabled={paused}
                          onClick={() => setRemoving(item)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          {item.seriesId ? "Delete routine" : "Cancel workout"}
                        </button>
                      )}
                      <Link
                        href={`/sessions/calendar?date=${localDate(item.startsAt, timezone)}&timezone=${encodeURIComponent(timezone)}&selected=${encodeURIComponent(item.key)}`}
                      >
                        View in Calendar
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <div className="routine-day-add">
                <button
                  className="routine-text-button"
                  aria-label={`Add ${weekday} workout`}
                  disabled={paused}
                  onClick={() => setEditor({ date: startDate, weekly: true })}
                >
                  <Plus size={15} aria-hidden="true" />
                  Add workout
                </button>
                {startDate !== day.date && (
                  <small>Starts {dateLabel(startDate)}</small>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {page.next !== null && (
        <section className="training-more">
          <p>
            More training is available in this week. Load it to see all your
            planned workouts.
          </p>
          <button disabled={busy} onClick={workspace.loadMore}>
            Load more training
          </button>
        </section>
      )}
      {editor && (
        <WorkoutEditor
          routine
          defaultWeekly={editor.weekly}
          item={editor.item}
          series={!!editor.item?.seriesId}
          timezone={timezone}
          referenceTime={page.now}
          selectedDay={editor.date}
          busy={busy}
          error={error}
          onRetry={pending ? () => void save(pending) : undefined}
          onClose={() => setEditor(null)}
          onSave={(command) => void save(command)}
        />
      )}
      {removing && (
        <Modal
          title={removing.seriesId ? "Delete routine?" : "Cancel workout?"}
          eyebrow="MY TRAINING"
          className="training-dialog"
          onClose={() => setRemoving(null)}
        >
          <p>
            <strong>{removing.title}</strong>
          </p>
          <p>
            {removing.seriesId
              ? "All future repeats will stop, including workouts you moved to another date. Past workouts, workouts already started and your logs stay in Calendar."
              : "This workout will be cancelled. Its details and notes stay in Calendar."}
          </p>
          {error && (
            <div role="alert">
              <p>{error}</p>
              {pending && (
                <button disabled={busy} onClick={() => void save(pending)}>
                  Retry last save
                </button>
              )}
            </div>
          )}
          <div className="training-actions">
            <button
              className="button secondary"
              onClick={() => setRemoving(null)}
            >
              {pending
                ? "Close"
                : removing.seriesId
                  ? "Keep routine"
                  : "Keep workout"}
            </button>
            <button
              className="button dark"
              disabled={paused}
              onClick={() =>
                void save({
                  action: removing.seriesId ? "stop" : "attendance",
                  args: {
                    commandId: crypto.randomUUID(),
                    ...(removing.seriesId
                      ? {
                          seriesId: removing.seriesId,
                          planRevision: removing.planRevision,
                        }
                      : {
                          key: removing.key,
                          revision: removing.revision,
                          attendance: "cancelled",
                          notes: removing.notes,
                          intensity: removing.intensity,
                          actualMinutes: removing.actualMinutes,
                        }),
                  },
                })
              }
            >
              {busy
                ? "Saving…"
                : removing.seriesId
                  ? "Delete routine"
                  : "Cancel workout"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
