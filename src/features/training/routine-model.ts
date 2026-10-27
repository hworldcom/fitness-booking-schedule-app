import {
  addDays,
  calendarPeriod,
  localDate,
  type TrainingItem,
} from "@/training/contracts";

export function routineDays(
  date: string,
  items: readonly TrainingItem[],
  timezone: string,
) {
  const period = calendarPeriod(date, "week");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const byDay = new Map<string, TrainingItem[]>();
  for (const item of items) {
    if (item.source !== "personal" || item.attendance !== "planned") continue;
    const day = formatter.format(new Date(item.startsAt));
    const entries = byDay.get(day) ?? [];
    entries.push(item);
    byDay.set(day, entries);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(period.from, index);
    return {
      date: day,
      items: byDay.get(day) ?? [],
    };
  });
}

// A past weekday (or a day that ends before the default start) starts next time
// that weekday occurs. Opening the planner must not create backdated plans.
export function nextRoutineDate(day: string, now: string, timezone: string) {
  const earliest = localDate(new Date(Date.parse(now) + 3600000), timezone);
  if (day >= earliest) return day;
  const weekday = (value: string) => new Date(`${value}T12:00:00Z`).getUTCDay();
  return addDays(earliest, (weekday(day) - weekday(earliest) + 7) % 7);
}

export function routineHref(date: string, timezone: string) {
  return `/sessions/routine?date=${date}&timezone=${encodeURIComponent(timezone)}`;
}
