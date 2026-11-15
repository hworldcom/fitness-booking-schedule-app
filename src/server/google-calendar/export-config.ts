import "server-only";
import { parseCalendarConfig } from "./config";
import { parseDatabaseUrl } from "@/server/db/config";
import { calendarExportTargetMatches } from "./export-target.mjs";

export function parseCalendarExportConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env.MOVX_GOOGLE_CALENDAR_EXPORT_ENABLED !== "true") return null;
  try {
    const calendar = parseCalendarConfig(env);
    if (!calendar) return null;
    if (!calendarExportTargetMatches(env)) return null;
    return {
      calendar,
      workerUrl: parseDatabaseUrl(env.GOOGLE_CALENDAR_WORKER_DATABASE_URL)
        .connectionString,
    };
  } catch {
    return null;
  }
}
