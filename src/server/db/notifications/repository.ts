import "server-only";
import { sql } from "drizzle-orm";
import {
  parseNotificationPage,
  type NotificationCommand,
} from "@/notifications/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";

export async function notificationCommandRecord(
  tx: ActorDatabaseTransaction,
  command: NotificationCommand,
) {
  const rows = await tx.execute<{ result: unknown }>(
    sql`select app.notification_command(${command.action}::text,${JSON.stringify(command.args)}::jsonb) result`,
  );
  if (rows.length !== 1) throw Error("Notification unavailable.");
  return command.action === "list" ? parseNotificationPage(rows[0].result) : {};
}
