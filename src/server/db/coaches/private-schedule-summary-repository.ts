import "server-only";
import { sql } from "drizzle-orm";
import { privateScheduleSummary } from "@/domain/private-schedule-summary";
import {
  withDatabaseConnection,
  type DatabaseConnection,
} from "@/server/db/client";

export async function typedPrivateScheduleSummaryRecord(
  slug: string,
  connection?: DatabaseConnection,
) {
  return withDatabaseConnection(async ({ db }) => {
    // Reuse full-fit/venue/conflict authority. Aggregate inside PostgreSQL so
    // no individual private time or identifier leaves this repository.
    const rows = await db.execute<{ date: string; open_slots: number }>(sql`
      select to_char(local_date, 'YYYY-MM-DD') as date, open_slots
      from app.public_private_schedule_preview(${slug}) order by local_date
    `);
    return privateScheduleSummary(
      rows.map((row) => ({ date: row.date, count: row.open_slots })),
    );
  }, connection);
}
