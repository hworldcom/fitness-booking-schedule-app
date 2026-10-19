import { addCalendarDays, calendarDate } from "./coach-calendar";
import type { PublicCoachAvailabilitySlot } from "./coaches";
import { publicScheduleSlots } from "./public-coach-schedule";
import { isAvailabilityDate } from "./effective-availability";

export type PrivateScheduleDay = Readonly<{ date: string; count: number }>;

export type PrivateScheduleSummary =
  | Readonly<{
      status: "ready";
      count: number;
      days: readonly PrivateScheduleDay[];
    }>
  | Readonly<{ status: "unavailable" }>;

export function legacyPrivateScheduleSummary(
  slots: readonly PublicCoachAvailabilitySlot[],
  databaseTime: string,
): PrivateScheduleSummary {
  const today = calendarDate(databaseTime);
  const eligible = publicScheduleSlots(slots, databaseTime);
  return privateScheduleSummary(
    Array.from({ length: 7 }, (_, offset) => {
      const date = addCalendarDays(today, offset);
      const starts = eligible
        .filter((slot) => calendarDate(slot.startsAt) === date)
        .map((slot) => Date.parse(slot.startsAt));
      return { date, count: new Set(starts).size };
    }),
  );
}

export function privateScheduleSummary(
  days: readonly PrivateScheduleDay[],
): Extract<PrivateScheduleSummary, { status: "ready" }> {
  if (days.length !== 7)
    throw new Error("Private availability dates are unavailable.");
  const projected = days.map((day, index) => {
    if (
      !isAvailabilityDate(day.date) ||
      (index > 0 && day.date !== addCalendarDays(days[0].date, index))
    )
      throw new Error("Private availability dates are unavailable.");
    const count = parsePrivateScheduleCount(day.count);
    if (count > 100)
      throw new Error("Private availability count is unavailable.");
    return { date: day.date, count };
  });
  return {
    status: "ready",
    count: parsePrivateScheduleCount(
      projected.reduce((sum, day) => sum + day.count, 0),
    ),
    days: projected,
  };
}

export function parsePrivateScheduleCount(value: unknown): number {
  // Seven local dates have at most 700 quarter-hour starts, including DST.
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 700)
    throw new Error("Private availability count is unavailable.");
  return Number(value);
}
