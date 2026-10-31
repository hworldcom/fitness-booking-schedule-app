export type CoachApprovalNotification = Readonly<{
  kind: "coach-approval";
  event: "approved";
  displayName: string;
  approvedAt: string;
}>;
export const COACH_APPROVAL_TITLE = "Your coach application was approved";
export const COACH_APPROVAL_NEXT_STEPS =
  "Finish setting up your coach profile, then publish it when you’re ready. Open your profile for your current status.";
export function parseCoachApprovalNotification(
  value: unknown,
): CoachApprovalNotification {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid coach approval.");
  const v = value as Record<string, unknown>;
  if (
    v.kind !== "coach-approval" ||
    v.event !== "approved" ||
    typeof v.displayName !== "string" ||
    v.displayName.trim().length < 2 ||
    v.displayName.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(v.displayName) ||
    typeof v.approvedAt !== "string" ||
    v.approvedAt.length > 40 ||
    !/^\d{4}-\d\d-\d\dT/.test(v.approvedAt) ||
    !Number.isFinite(Date.parse(v.approvedAt))
  )
    throw Error("Invalid coach approval.");
  return {
    kind: "coach-approval",
    event: "approved",
    displayName: v.displayName,
    approvedAt: v.approvedAt,
  };
}
