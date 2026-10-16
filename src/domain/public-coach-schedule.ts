import { addCalendarDays, calendarDate } from "./coach-calendar";
import type { PublicCoachAvailabilitySlot } from "./coaches";
import { isAvailabilityDate } from "./effective-availability";

export function publicScheduleSelection(value: unknown, databaseTime: string) {
  if (!Number.isFinite(Date.parse(databaseTime)))
    throw new Error("Schedule time is unavailable.");
  const today = calendarDate(databaseTime);
  const through = addCalendarDays(today, 29);
  const invalid =
    value !== undefined &&
    (typeof value !== "string" || !isAvailabilityDate(value));
  const date = typeof value === "string" && !invalid ? value : today;
  const inHorizon = date >= today && date <= through;
  const offset = inHorizon
    ? Math.round((Date.parse(date) - Date.parse(today)) / 86400000)
    : 0;
  const page = Math.floor(offset / 7);
  const dates = Array.from({ length: Math.min(7, 30 - page * 7) }, (_, i) =>
    addCalendarDays(today, page * 7 + i),
  );
  return Object.freeze({
    today,
    through,
    date,
    invalid,
    inHorizon,
    dates: Object.freeze(dates),
    previous: page > 0 ? addCalendarDays(today, (page - 1) * 7) : null,
    next: page < 4 ? addCalendarDays(today, (page + 1) * 7) : null,
  });
}

export function publicScheduleHref(slug: string, date: string) {
  return `/coaches/${encodeURIComponent(slug)}?date=${encodeURIComponent(date)}#private-schedule`;
}

/** Presentation follows the public database projection; mutations recheck it. */
export function publicScheduleSlots(
  slots: readonly PublicCoachAvailabilitySlot[],
  databaseTime: string,
) {
  const { today, through } = publicScheduleSelection(undefined, databaseTime);
  const now = Date.parse(databaseTime);
  return Object.freeze(
    slots
      .filter((slot) => {
        const start = Date.parse(slot.startsAt);
        if (
          !Number.isFinite(start) ||
          start <= now ||
          slot.requestEligibility !== "requestable"
        )
          return false;
        const date = calendarDate(slot.startsAt);
        return date >= today && date <= through;
      })
      .sort(
        (a, b) =>
          a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
      ),
  );
}
