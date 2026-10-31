import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  parseCoachApprovalNotification,
  type CoachApprovalNotification,
} from "@/notifications/coach-approvals";
export type CoachApprovalEmailPayload = CoachApprovalNotification & {
  id: string;
  email: string;
};
export function parseCoachApprovalEmail(
  value: unknown,
): CoachApprovalEmailPayload {
  const approval = parseCoachApprovalNotification(value);
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    !isCanonicalUuid(v.id) ||
    typeof v.email !== "string" ||
    v.email.length > 320 ||
    !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(v.email)
  )
    throw Error("Invalid approval email.");
  return { ...approval, id: v.id, email: v.email };
}
