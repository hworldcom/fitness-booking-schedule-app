import {
  addDays,
  calendarPeriod,
  localDate,
  type TrainingItem,
  type TrainingPage,
} from "@/training/contracts";

export function progressPeriods(now: string, timezone: string) {
  const today = localDate(now, timezone);
  const week = calendarPeriod(today, "week");
  const monthFrom = today.slice(0, 8) + "01";
  const monthThrough = addDays(calendarPeriod(today, "month").next, -1);
  return {
    week: { from: week.from, through: week.through },
    month: { from: monthFrom, through: monthThrough },
    from: week.from < monthFrom ? week.from : monthFrom,
    through: week.through > monthThrough ? week.through : monthThrough,
  };
}

export type ProgressPeriod = Readonly<{
  minutes: number;
  ratedCount: number;
  averageDifficulty: number | null;
}>;
export type TrainingProgress = Readonly<{
  week: ProgressPeriod;
  month: ProgressPeriod;
}>;

export function summarizeProgress(
  items: readonly TrainingItem[],
  now: string,
  timezone: string,
): TrainingProgress {
  const periods = progressPeriods(now, timezone);
  const unique = new Map(items.map((item) => [item.key, item]));
  const summarize = (period: { from: string; through: string }) => {
    let minutes = 0,
      difficulty = 0,
      ratedCount = 0;
    for (const item of unique.values()) {
      const date = localDate(item.startsAt, timezone);
      if (
        item.attendance !== "attended" ||
        date < period.from ||
        date > period.through
      )
        continue;
      minutes +=
        item.actualMinutes ??
        (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000;
      const rating =
        ["Easy", "Moderate", "Hard"].indexOf(item.intensity ?? "") + 1;
      if (rating) {
        difficulty += rating;
        ratedCount++;
      }
    }
    return {
      minutes,
      ratedCount,
      averageDifficulty: ratedCount ? difficulty / ratedCount : null,
    };
  };
  return { week: summarize(periods.week), month: summarize(periods.month) };
}

// The visible calendar is only one page of an independently browsed period.
// Complete both current periods before exposing any totals.
export async function loadProgress(
  list: (args: {
    from: string;
    through: string;
    timezone: string;
    offset: number;
  }) => Promise<TrainingPage>,
  now: string,
  timezone: string,
): Promise<TrainingProgress> {
  const { from, through } = progressPeriods(now, timezone);
  const items: TrainingItem[] = [];
  let offset = 0;
  for (;;) {
    const page = await list({ from, through, timezone, offset });
    items.push(...page.items);
    if (page.next === null) return summarizeProgress(items, now, timezone);
    if (page.next <= offset || page.next > 10000)
      throw Error("Incomplete training progress");
    offset = page.next;
  }
}

export function difficultyLabel(average: number) {
  return average < 1.5 ? "Easy" : average < 2.5 ? "Moderate" : "Hard";
}

export function trainingHours(minutes: number) {
  return minutes > 0 && minutes < 6 ? "<0.1" : (minutes / 60).toFixed(1);
}
