import assert from "node:assert/strict";
import test from "node:test";
import { calendarItemPresentation } from "../src/features/training/calendar-item-model";
import type { TrainingItem } from "../src/training/contracts";

const now = "2026-11-08T12:00:00Z";
const item: TrainingItem = {
  key: "manual:fixture",
  source: "personal",
  title: "Training",
  startsAt: "2026-11-08T09:00:00Z",
  endsAt: "2026-11-08T10:00:00Z",
  timezone: "UTC",
  state: "planned",
  attendance: "planned",
  notes: "Private history",
  intensity: null,
  actualMinutes: null,
  revision: 0,
  seriesId: null,
  planRevision: null,
  href: null,
  location: null,
};

test("canonical cancellation stays primary despite a separate historic attendance log", () => {
  for (const source of ["booking", "group"] as const)
    for (const attendance of ["planned", "attended", "skipped"] as const) {
      const value = calendarItemPresentation(
        { ...item, source, state: "cancelled", attendance },
        now,
      );
      assert.equal(value.label, "Cancelled");
      assert.equal(value.summary, "Cancelled");
      assert.equal(value.tone, "cancelled");
      assert.equal(value.canSetAttendance, false);
      assert.equal(value.canAttend, false);
      assert.equal(value.canCancel, false);
      assert.equal(
        value.previousAttendance,
        attendance === "planned" ? null : `Previously marked ${attendance}`,
      );
    }
});

test("personal cancellation is retained without inviting attendance or another cancellation", () => {
  const cancelled = Object.freeze({
    ...item,
    attendance: "cancelled" as const,
  });
  const value = calendarItemPresentation(cancelled, now);
  assert.equal(value.label, "Cancelled");
  assert.equal(value.tone, "cancelled");
  assert.equal(value.canSetAttendance, false);
  assert.equal(value.canCancel, false);
  assert.equal(cancelled.notes, "Private history");
  assert.equal(cancelled.attendance, "cancelled");
});

test("attendance is distinct from coach completion and remains correctable", () => {
  assert.equal(
    calendarItemPresentation(
      { ...item, source: "booking", state: "completed" },
      now,
    ).summary,
    "Coach marked complete · Attendance not recorded",
  );
  for (const attendance of ["attended", "skipped"] as const) {
    const value = calendarItemPresentation({ ...item, attendance }, now);
    assert.equal(
      value.label,
      attendance === "attended" ? "Attended" : "Skipped",
    );
    assert.equal(value.canSetAttendance, true);
    assert.equal(value.canCancel, false);
  }
});

test("only future planned personal workouts offer cancellation", () => {
  const future = {
    ...item,
    startsAt: "2026-11-08T13:00:00Z",
    endsAt: "2026-11-08T14:00:00Z",
  };
  assert.equal(calendarItemPresentation(future, now).canCancel, true);
  assert.equal(calendarItemPresentation(item, now).canCancel, false);
  assert.equal(
    calendarItemPresentation(future, future.startsAt).canCancel,
    false,
  );
  for (const source of ["booking", "group", "request"] as const)
    assert.equal(
      calendarItemPresentation({ ...future, source }, now).canCancel,
      false,
    );
  for (const attendance of ["attended", "skipped", "cancelled"] as const)
    assert.equal(
      calendarItemPresentation({ ...future, attendance }, now).canCancel,
      false,
    );
});

test("future, request and unavailable-time records cannot offer an attended write", () => {
  assert.equal(calendarItemPresentation(item, now).canAttend, true);
  assert.equal(calendarItemPresentation(item, item.endsAt).canAttend, true);
  assert.equal(calendarItemPresentation(item, item.startsAt).canAttend, false);
  assert.equal(
    calendarItemPresentation({ ...item, source: "request" }, now)
      .canSetAttendance,
    false,
  );
  const unavailable = calendarItemPresentation(
    { ...item, state: "time-unavailable" },
    now,
  );
  assert.equal(unavailable.canSetAttendance, false);
  assert.equal(unavailable.canCancel, false);
  assert.equal(calendarItemPresentation(item, "invalid").canAttend, false);
  assert.equal(calendarItemPresentation(item, "invalid").canCancel, false);
});
