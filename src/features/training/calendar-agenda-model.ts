import {
  addDays,
  calendarPeriod,
  localDate,
  type TrainingItem,
} from "@/training/contracts";

export function trainingItemDateRange(item: TrainingItem, timezone: string) {
  return {
    from: localDate(item.startsAt, timezone),
    through: localDate(new Date(Date.parse(item.endsAt) - 1), timezone),
  };
}

// Group the existing bounded read; this never fetches more data or changes totals.
export function weeklyTrainingAgenda(
  items: readonly TrainingItem[],
  date: string,
  timezone: string,
) {
  const { from, through } = calendarPeriod(date, "week");
  const ordered = [...items].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const ranges = new Map(
    ordered.map((item) => [item.key, trainingItemDateRange(item, timezone)]),
  );
  return {
    from,
    through,
    days: Array.from({ length: 7 }, (_, n) => {
      const day = addDays(from, n);
      return {
        date: day,
        items: ordered.filter((item) => {
          const range = ranges.get(item.key)!;
          return range.from <= day && range.through >= day;
        }),
      };
    }),
  };
}
