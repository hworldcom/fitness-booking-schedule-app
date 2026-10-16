"use server";
import { loadCoachCalendar } from "@/server/coaches/calendar-service";
import type { CoachCalendarResult } from "@/features/coaches/coach-calendar-model";
export async function loadCoachCalendarAction(
  query: unknown,
  scope: string,
): Promise<CoachCalendarResult> {
  if (typeof scope !== "string" || !scope || scope.length > 160)
    return {
      status: "denied",
      message:
        "Reload the current coach workspace before reading the calendar.",
    };
  return loadCoachCalendar(query, scope);
}
