import { runNotificationWorker } from "../src/server/notifications/worker";
try {
  console.log(JSON.stringify(await runNotificationWorker()));
} catch {
  console.error(
    "Notification dispatch failed. Check the server-only worker/transport configuration; no credential values are printed.",
  );
  process.exitCode = 1;
}
