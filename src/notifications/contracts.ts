import { isCanonicalUuid } from "@/domain/coach-bookings";

export type NotificationItem = Readonly<{
  id: string;
  conversationId: string;
  senderName: string;
  createdAt: string;
  readAt: string | null;
}>;
export type NotificationPage = Readonly<{
  items: readonly NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
  snapshotAt: string;
}>;
export type NotificationCommand = Readonly<{
  action: "list" | "read" | "read-all";
  args: Record<string, unknown>;
}>;
export type NotificationResult =
  | { status: "ready"; value: NotificationPage | Record<string, never> }
  | {
      status:
        | "invalid"
        | "conflict"
        | "signed-out"
        | "forbidden"
        | "preview"
        | "unavailable";
    };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid notification response.");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    /^\d{4}-\d\d-\d\dT/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function id(value: unknown): value is string {
  return typeof value === "string" && isCanonicalUuid(value);
}
export function validNotificationCommand(
  value: unknown,
): value is NotificationCommand {
  try {
    const command = object(value),
      args = object(command.args);
    if (Object.keys(command).some((k) => !["action", "args"].includes(k)))
      return false;
    if (command.action === "list")
      return (
        Object.keys(args).every((k) =>
          ["filter", "beforeAt", "beforeId"].includes(k),
        ) &&
        (args.filter === undefined ||
          args.filter === "all" ||
          args.filter === "unread") &&
        ((args.beforeAt === undefined && args.beforeId === undefined) ||
          (timestamp(args.beforeAt) && id(args.beforeId)))
      );
    if (command.action === "read")
      return Object.keys(args).length === 1 && id(args.id);
    if (command.action === "read-all")
      return Object.keys(args).length === 1 && timestamp(args.throughAt);
    return false;
  } catch {
    return false;
  }
}
export function parseNotificationPage(value: unknown): NotificationPage {
  const page = object(value);
  if (
    !Array.isArray(page.items) ||
    page.items.length > 20 ||
    !Number.isSafeInteger(page.unreadCount) ||
    Number(page.unreadCount) < 0 ||
    typeof page.hasMore !== "boolean" ||
    !timestamp(page.snapshotAt)
  )
    throw Error("Invalid notification response.");
  return {
    items: page.items.map((value) => {
      const item = object(value);
      if (
        !id(item.id) ||
        !id(item.conversationId) ||
        typeof item.senderName !== "string" ||
        !item.senderName.trim() ||
        item.senderName.length > 120 ||
        !timestamp(item.createdAt) ||
        (item.readAt !== null && !timestamp(item.readAt))
      )
        throw Error("Invalid notification response.");
      return {
        id: item.id,
        conversationId: item.conversationId,
        senderName: item.senderName,
        createdAt: item.createdAt,
        readAt: item.readAt,
      };
    }),
    unreadCount: Number(page.unreadCount),
    hasMore: page.hasMore,
    snapshotAt: page.snapshotAt,
  };
}
export function notificationHref(
  item: Pick<NotificationItem, "conversationId">,
) {
  if (!id(item.conversationId))
    throw Error("Invalid notification destination.");
  return `/messages?conversation=${item.conversationId}`;
}
