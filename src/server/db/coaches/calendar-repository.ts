import "server-only";
import { sql } from "drizzle-orm";
import { parseCalendarPage, type CalendarQuery } from "@/domain/coach-calendar";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
export async function ownedCoachCalendarRecord(
  tx: ActorDatabaseTransaction,
  query: CalendarQuery,
) {
  const rows = await tx.execute<{ result: unknown }>(
    sql`select app.owned_coach_calendar(${JSON.stringify(query)}::jsonb) result`,
  );
  if (rows.length !== 1) throw new Error("Calendar projection is unavailable.");
  return parseCalendarPage(rows[0].result, query);
}
