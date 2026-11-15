import "server-only";
import postgres from "postgres";
import { parseDatabaseUrl } from "../config";
import type { ExportRepository } from "@/server/google-calendar/export-worker";

export async function withCalendarExportWorker<T>(
  url: string | undefined,
  clientHash: string,
  work: (repository: ExportRepository) => Promise<T>,
) {
  const config = parseDatabaseUrl(url);
  const db = postgres(config.connectionString, {
    ssl: config.ssl,
    max: 1,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const [role] =
      await db`select r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb
      or pg_has_role(current_user,'app_owner','MEMBER') or pg_has_role(current_user,'app_runtime','MEMBER')
      or pg_has_role(current_user,'app_notification_worker','MEMBER') unsafe,
      pg_has_role(current_user,'app_calendar_worker','MEMBER') worker from pg_roles r where r.rolname=current_user`;
    if (!role?.worker || role.unsafe)
      throw Error("Calendar delivery requires its restricted worker login.");
    await db`set statement_timeout='10s'`;
    return await work({
      async claim() {
        const [row] =
          await db`select app.google_calendar_export_claim(${clientHash}) value`;
        return row.value;
      },
      async command(claim, action, input = {}) {
        const [row] =
          await db`select app.google_calendar_export_work(${claim.id}::uuid,${claim.leaseId}::uuid,${action},${db.json(input as postgres.JSONValue)}) value`;
        return row.value;
      },
    });
  } finally {
    await db.end({ timeout: 5 });
  }
}
