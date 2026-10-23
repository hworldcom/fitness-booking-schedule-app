import "server-only";
import {
  validNotificationCommand,
  type NotificationResult,
} from "@/notifications/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import { notificationCommandRecord } from "@/server/db/notifications/repository";

export async function currentNotificationCommand(
  command: unknown,
): Promise<NotificationResult> {
  if (!validNotificationCommand(command)) return { status: "invalid" };
  const result = await withAuthorizedActor((tx) =>
    notificationCommandRecord(tx, command),
  );
  return result.status === "authorized"
    ? { status: "ready", value: result.value }
    : result;
}
