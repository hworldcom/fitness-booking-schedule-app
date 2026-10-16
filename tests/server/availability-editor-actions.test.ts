import assert from "node:assert/strict";
import test from "node:test";
import {
  changeAvailabilityEditorAction,
  loadAvailabilityEditorAction,
} from "@/app/coach/availability-actions";

test("availability actions reject malformed drafts and excessive reads before authorization", async () => {
  for (const value of [
    null,
    { kind: "weekly", hours: [] },
    { kind: "dates", dates: [] },
  ])
    assert.equal(
      (await changeAvailabilityEditorAction(value, "scope", true)).status,
      "invalid",
    );
  for (const [from, through] of [
    ["2026-10-01", "2026-11-01"],
    ["invalid", "2026-10-31"],
    ["2026-10-20", "2026-10-01"],
  ])
    assert.equal(
      (await loadAvailabilityEditorAction(from, through, "scope")).status,
      "unavailable",
    );
});
