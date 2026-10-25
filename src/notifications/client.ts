import {
  NOTIFICATION_VERSION_HEADER,
  parseNotificationPage,
  type NotificationCommand,
} from "./contracts";

export class NotificationError extends Error {
  constructor(readonly status: string) {
    super(
      status === "signed-out" || status === "forbidden"
        ? "Your access changed. Sign in again to view notifications."
        : "Notifications are unavailable. Please try again.",
    );
  }
}
async function result(response: Response) {
  const value = await response.json();
  if (!response.ok || value.status !== "ready")
    throw new NotificationError(value.status ?? "unavailable");
  return value.value as unknown;
}
export async function notificationList(
  args: Record<string, string>,
  signal: AbortSignal,
) {
  return parseNotificationPage(
    await result(
      await fetch(`/api/notifications?${new URLSearchParams(args)}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { [NOTIFICATION_VERSION_HEADER]: "3" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      }),
    ),
  );
}
export async function notificationWrite(
  command: NotificationCommand,
  signal: AbortSignal,
) {
  await result(
    await fetch("/api/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        [NOTIFICATION_VERSION_HEADER]: "3",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    }),
  );
}
