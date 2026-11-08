import type { TrainingItem } from "@/training/contracts";

// Display/action policy only. Source lifecycle and personal attendance stay
// separate, and every write still uses the existing actor-bound command.
export function calendarItemPresentation(item: TrainingItem, now: string) {
  const cancelled =
    item.state === "cancelled" ||
    (item.source === "personal" && item.attendance === "cancelled");
  const state =
    item.state === "completed"
      ? "Coach marked complete"
      : item.state.replaceAll("-", " ").replace(/^./, (s) => s.toUpperCase());
  const attendance =
    item.attendance === "attended"
      ? "You confirmed attendance"
      : item.attendance === "skipped"
        ? "You marked this as skipped"
        : "Attendance not recorded";
  const canSetAttendance =
    !cancelled &&
    item.source !== "request" &&
    item.state !== "time-unavailable";
  return {
    cancelled,
    tone: cancelled ? "cancelled" : item.attendance,
    label: cancelled
      ? "Cancelled"
      : item.attendance === "attended"
        ? "Attended"
        : item.attendance === "skipped"
          ? "Skipped"
          : state,
    summary: cancelled
      ? "Cancelled"
      : item.source === "personal"
        ? attendance
        : `${state} · ${attendance}`,
    previousAttendance:
      cancelled && ["attended", "skipped"].includes(item.attendance)
        ? `Previously marked ${item.attendance}`
        : null,
    canSetAttendance,
    canAttend: canSetAttendance && Date.parse(item.endsAt) <= Date.parse(now),
    canCancel:
      canSetAttendance &&
      item.source === "personal" &&
      item.attendance === "planned" &&
      Date.parse(item.startsAt) > Date.parse(now),
  };
}
