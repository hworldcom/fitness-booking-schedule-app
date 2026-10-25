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
  version: 1 | 2 | 3 = 1,
) {
  const fn =
    version === 3
      ? sql`app.notification_command_v3`
      : version === 2
        ? sql`app.notification_command_v2`
        : sql`app.notification_command`;
  const rows = await tx.execute<{ result: unknown }>(
    sql`select ${fn}(${command.action}::text,${JSON.stringify(command.args)}::jsonb) result`,
  );
  if (rows.length !== 1) throw Error("Notification unavailable.");
  return command.action === "list" ? parseNotificationPage(rows[0].result) : {};
}
