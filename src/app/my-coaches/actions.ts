"use server";
import { currentAthleteCoaches } from "@/server/connections/athlete-coaches-service";

export async function loadAthleteCoachesAction(
  scope: string,
  filter: unknown,
  cursor: unknown = null,
) {
  return currentAthleteCoaches(scope, filter, cursor);
}
