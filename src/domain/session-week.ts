import { calendarDate } from "./coach-calendar";
import { publicScheduleSelection } from "./public-coach-schedule";
import type { SessionDuration } from "./session-types";
import type { SessionTime } from "./typed-sessions";

export type SessionWeek = Readonly<{
  referenceTime: string;
  resetToCurrent: boolean;
  days: readonly Readonly<{ date: string; times: readonly SessionTime[] }>[];
}>;

/** Validate a complete week; a missing/corrupt day must never look like zero. */
export function parseSessionWeek(
  value: unknown,
  requestedDate: string,
  duration?: SessionDuration,
): SessionWeek {
  const week = value as SessionWeek | null;
  if (
    !week ||
    typeof week.referenceTime !== "string" ||
    !Number.isFinite(Date.parse(week.referenceTime)) ||
    !Array.isArray(week.days)
  )
    throw new Error("Invalid availability week.");
  const selection = publicScheduleSelection(requestedDate, week.referenceTime);
  if (
    week.resetToCurrent !== !selection.inHorizon ||
    week.days.length !== selection.dates.length
  )
    throw new Error("Invalid availability window.");
  const now = Date.parse(week.referenceTime);
  const days = week.days.map((day, index) => {
    if (
      !day ||
      day.date !== selection.dates[index] ||
      !Array.isArray(day.times) ||
      day.times.length > 100
    )
      throw new Error("Invalid availability day.");
    let previous = -Infinity;
    const times = day.times.map((time: SessionTime) => {
      const start = Date.parse(time?.startsAt),
        end = Date.parse(time?.endsAt);
      const minutes = (end - start) / 60000;
      if (
        typeof time?.startsAt !== "string" ||
        typeof time?.endsAt !== "string" ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= now ||
        start <= previous ||
        start % 900000 !== 0 ||
        calendarDate(time.startsAt) !== day.date ||
        !(duration ? minutes === duration : [60, 75, 90].includes(minutes))
      )
        throw new Error("Invalid availability time.");
      previous = start;
      return Object.freeze({ startsAt: time.startsAt, endsAt: time.endsAt });
    });
    return Object.freeze({ date: day.date, times: Object.freeze(times) });
  });
  return Object.freeze({
    referenceTime: week.referenceTime,
    resetToCurrent: week.resetToCurrent,
    days: Object.freeze(days),
  });
}
