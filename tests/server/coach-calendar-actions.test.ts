import assert from "node:assert/strict";
import test from "node:test";
import { loadCoachCalendarAction } from "@/app/coach/calendar-actions";
test("calendar actions reject forged/oversized scopes and invalid periods before authorization", async () => {
  assert.equal((await loadCoachCalendarAction({}, "")).status, "denied");
  assert.equal(
    (await loadCoachCalendarAction({}, "x".repeat(161))).status,
    "denied",
  );
  for (const query of [
    null,
    {},
    {
      from: "2026-10-01",
      through: "2026-11-15",
      type: "all",
      venueId: null,
      history: false,
      after: null,
    },
  ])
    assert.equal(
      (await loadCoachCalendarAction(query, "scope")).status,
      "invalid",
    );
});
