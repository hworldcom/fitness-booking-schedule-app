"use client";
import type { FormEvent } from "react";
import { Modal } from "@/components/ui";
import {
  localDate,
  spontaneousDefaults,
  type TrainingCommand,
  type TrainingItem,
} from "@/training/contracts";

export function WorkoutEditor({
  item,
  routine = false,
  defaultWeekly = false,
  log,
  series,
  timezone,
  busy,
  onClose,
  onSave,
  referenceTime,
  selectedDay,
  error,
  onRetry,
}: {
  item?: TrainingItem;
  routine?: boolean;
  defaultWeekly?: boolean;
  log?: boolean;
  series?: boolean;
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onSave: (command: TrainingCommand) => void;
  referenceTime: string;
  selectedDay: string;
  error: string;
  onRetry?: () => void;
}) {
  const zone = item?.timezone ?? timezone;
  const spontaneous = spontaneousDefaults(referenceTime, zone);
  const initialTime =
    item?.startsAt ??
    (log
      ? spontaneous.startsAt
      : new Date(Date.parse(referenceTime) + 60 * 60000).toISOString());
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(initialTime));
  const linked = item && item.source !== "personal";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const optional = {
      notes: String(f.get("notes") ?? ""),
      intensity: f.get("intensity") || null,
      actualMinutes: f.get("actualMinutes")
        ? Number(f.get("actualMinutes"))
        : null,
    };
    const commandId = crypto.randomUUID();
    onSave(
      linked
        ? {
            action: "attendance",
            args: {
              commandId,
              key: item.key,
              revision: item.revision,
              attendance: item.attendance,
              ...optional,
            },
          }
        : {
            action: series ? "series" : "save",
            args: {
              commandId,
              ...(series
                ? { seriesId: item?.seriesId, planRevision: item?.planRevision }
                : item
                  ? { key: item.key, revision: item.revision }
                  : {}),
              title: String(f.get("title")),
              date: String(f.get("date")),
              time: String(f.get("time")),
              timezone: String(f.get("timezone")),
              minutes: Number(f.get("minutes")),
              weekly: series || f.get("weekly") === "on",
              completed: log === true || item?.attendance === "attended",
              ...optional,
            },
          },
    );
  };
  return (
    <Modal
      title={
        series
          ? routine
            ? "Edit routine"
            : "Edit future series"
          : linked
            ? "Your personal training log"
            : log
              ? "Log a workout"
              : item
                ? "Edit workout"
                : routine
                  ? "Add workout"
                  : "Plan training"
      }
      eyebrow="MY TRAINING"
      onClose={onClose}
      className="training-dialog"
    >
      <form onSubmit={submit}>
        {error && (
          <div role="alert">
            <p>{error}</p>
            {onRetry && (
              <button type="button" disabled={busy} onClick={onRetry}>
                Retry last save
              </button>
            )}
          </div>
        )}
        {!linked && (
          <>
            <label>
              Activity
              <input
                name="title"
                defaultValue={item?.title}
                required
                maxLength={80}
                placeholder="Boxing, a walk, strength training…"
              />
            </label>
            <div className="training-form-row">
              <label>
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    !item && !log ? selectedDay : localDate(initialTime, zone)
                  }
                  required
                />
              </label>
              <label>
                Time
                <input name="time" type="time" defaultValue={clock} required />
              </label>
            </div>
            <div className="training-form-row">
              <label>
                Planned minutes
                <input
                  name="minutes"
                  type="number"
                  min={1}
                  max={1440}
                  defaultValue={
                    item
                      ? Math.round(
                          (Date.parse(item.endsAt) -
                            Date.parse(item.startsAt)) /
                            60000,
                        )
                      : log
                        ? spontaneous.minutes
                        : 60
                  }
                  required
                />
              </label>
              <label>
                Timezone
                <input
                  name="timezone"
                  defaultValue={zone}
                  required
                  maxLength={80}
                />
              </label>
            </div>
            {!item && !log && (
              <label className="training-checkbox">
                <input
                  name="weekly"
                  type="checkbox"
                  defaultChecked={defaultWeekly}
                />
                Repeat weekly
              </label>
            )}
            {series && (
              <p>
                Changes apply to future, unlogged workouts. Past logs and
                individual edits stay saved.
              </p>
            )}
          </>
        )}
        {(log || (!!item && !series)) && (
          <details open={!!item?.notes || !!item?.intensity}>
            <summary>Optional workout details</summary>
            <label>
              Actual minutes
              <input
                name="actualMinutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={item?.actualMinutes ?? ""}
              />
            </label>
            <label>
              How did it feel?
              <select name="intensity" defaultValue={item?.intensity ?? ""}>
                <option value="">Not recorded</option>
                <option>Easy</option>
                <option>Moderate</option>
                <option>Hard</option>
              </select>
            </label>
            <label>
              Personal notes
              <textarea
                name="notes"
                maxLength={2000}
                rows={4}
                defaultValue={item?.notes ?? ""}
              />
            </label>
            <p>Only you can see these details.</p>
          </details>
        )}
        <div className="training-actions">
          <button className="button dark" disabled={busy} type="submit">
            {busy
              ? "Saving…"
              : log
                ? "Save completed workout"
                : routine
                  ? "Save workout"
                  : "Save training"}
          </button>
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
