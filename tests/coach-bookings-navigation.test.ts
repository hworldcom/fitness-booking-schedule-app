import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { coachBookingsSection } from "@/domain/coach-bookings-navigation";
import { CoachBookingsNavigation } from "@/features/coaches/coach-bookings-navigation";

const occurrence = "20800000-0000-4000-8000-000000000001";
test("Booked sessions is default; explicit sections and legacy occurrence links retain intent", () => {
  for (const value of [
    undefined,
    "",
    "other",
    "new-booking",
    ["requests", "sessions"],
  ])
    assert.equal(coachBookingsSection(value), "sessions");
  assert.equal(coachBookingsSection("requests"), "requests");
  assert.equal(coachBookingsSection(undefined, occurrence), "requests");
  assert.equal(coachBookingsSection("sessions", occurrence), "sessions");
  for (const invalid of ["bad", [occurrence, occurrence], undefined])
    assert.equal(coachBookingsSection(undefined, invalid), "sessions");
});

test("Bookings tabs have ordered destinations, one current tab and truthful full/zero/unavailable counts", () => {
  for (const active of ["sessions", "requests", "new-booking"] as const)
    for (const pendingCount of [72, 0, null]) {
      const html = renderToStaticMarkup(
        createElement(CoachBookingsNavigation, { active, pendingCount }),
      );
      assert.deepEqual(
        [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
        [
          "/coach?view=bookings",
          "/coach?view=bookings&amp;section=requests",
          "/coach/bookings/new",
        ],
      );
      assert.ok(
        html.indexOf("Booked sessions") < html.indexOf("Booking requests"),
      );
      assert.ok(
        html.indexOf("Booking requests") < html.indexOf("Schedule a client"),
      );
      assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
      assert.ok(
        html.includes(
          pendingCount === null
            ? "pending count unavailable"
            : `${pendingCount} pending`,
        ),
      );
      if (pendingCount === null) assert.doesNotMatch(html, /0 pending/);
    }
});
