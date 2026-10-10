import assert from "node:assert/strict";
import test from "node:test";
import {
  saveCoachAvailabilityRulesAction,
  type CoachAvailabilityActionState,
} from "@/app/coach/actions";

const idle: CoachAvailabilityActionState = Object.freeze({
  status: "idle",
  message: "",
  errors: Object.freeze([]),
});

test("complete schedule action rejects malformed drafts before mutation", async () => {
  const form = new FormData();
  form.set("selectedRules", "not-json");
  form.set("expectedRules", "[]");

  const result = await saveCoachAvailabilityRulesAction(idle, form);
  assert.equal(result.status, "invalid");
  assert.match(result.message, /Review the working-week selection/);
  assert.match(result.errors.join(" "), /working-week selection is invalid/);
});

test("complete schedule action rejects one cell assigned to two locations", async () => {
  const form = new FormData();
  form.set(
    "selectedRules",
    JSON.stringify([
      {
        locationId: "60000000-0000-4000-8000-000000000001",
        locationUpdatedAt: "2026-10-10T08:00:00.000Z",
        isoWeekday: 3,
        localStartTime: "10:00",
      },
      {
        locationId: "60000000-0000-4000-8000-000000000002",
        locationUpdatedAt: "2026-10-10T09:00:00.000Z",
        isoWeekday: 3,
        localStartTime: "10:00",
      },
    ]),
  );
  form.set("expectedRules", "[]");

  const result = await saveCoachAvailabilityRulesAction(idle, form);
  assert.equal(result.status, "invalid");
  assert.match(result.errors.join(" "), /duplicate hour/);
});
