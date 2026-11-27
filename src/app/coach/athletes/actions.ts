"use server";
import { currentCoachAthletes } from "@/server/connections/coach-athletes-service";

export async function loadCoachAthletesAction(
  scope: unknown,
  filter: unknown,
  cursor: unknown = null,
) {
  return currentCoachAthletes(scope, filter, cursor);
}
