import { runCalendarExportWorker } from "../src/server/google-calendar/export-worker";
import { execFileSync } from "node:child_process";
import { parseLocalSupabaseStatus } from "./lib/local-coach-accounts";
import { localDevelopmentProcessEnvironment } from "./lib/local-development";

try {
  const target = new URL(process.env.GOOGLE_CALENDAR_WORKER_DATABASE_URL ?? "");
  if (
    !/^postgres(?:ql)?:$/.test(target.protocol) ||
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    target.port !== "55322" ||
    target.pathname !== "/postgres"
  )
    throw new Error(
      "Local dispatcher requires the repository loopback database.",
    );
  const status = parseLocalSupabaseStatus(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      stdio: ["ignore", "pipe", "pipe"],
    }).toString(),
  );
  const environment = localDevelopmentProcessEnvironment(status);
  console.log(
    JSON.stringify({
      status: "ready",
      result: await runCalendarExportWorker(environment),
    }),
  );
} catch {
  console.error(
    "Calendar booking delivery is unavailable. Check its server-only configuration and restricted worker login.",
  );
  process.exitCode = 1;
}
