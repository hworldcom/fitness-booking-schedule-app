import { isCanonicalUuid } from "@/domain/coach-bookings";
import { coachAthletesHref } from "@/domain/coach-athletes-navigation";
import { myCoachesHref } from "@/domain/my-coaches-navigation";

export type ConnectionRequestNotification = Readonly<{
  kind: "connection-request";
  requestId: string;
  senderName: string;
  recipientRole: "coach" | "athlete";
}>;

export function parseConnectionRequestNotification(
  value: unknown,
): ConnectionRequestNotification {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid connection request notification.");
  const v = value as Record<string, unknown>;
  if (
    v.kind !== "connection-request" ||
    typeof v.requestId !== "string" ||
    !isCanonicalUuid(v.requestId) ||
    typeof v.senderName !== "string" ||
    !v.senderName.trim() ||
    v.senderName.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(v.senderName) ||
    !["coach", "athlete"].includes(String(v.recipientRole))
  )
    throw Error("Invalid connection request notification.");
  return {
    kind: "connection-request",
    requestId: v.requestId,
    senderName: v.senderName,
    recipientRole: v.recipientRole as "coach" | "athlete",
  };
}

export function connectionRequestNotificationHref(
  item: ConnectionRequestNotification,
) {
  const value = parseConnectionRequestNotification(item);
  return value.recipientRole === "coach"
    ? coachAthletesHref("requests")
    : myCoachesHref("requests");
}
