import assert from "node:assert/strict";
import test from "node:test";
import {
  isMembershipCheckinSnapshot,
  normalizeMembershipCheckinId,
  normalizeMembershipPresentationCode,
} from "@/domain/membership-checkins";

const periodId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const venueId = "44444444-4444-4444-8444-444444444444";

test("membership check-in identifiers and presentation codes are bounded", () => {
  assert.equal(normalizeMembershipCheckinId(periodId.toUpperCase()), periodId);
  assert.equal(normalizeMembershipCheckinId("not-a-uuid"), null);
  assert.equal(
    normalizeMembershipPresentationCode("A".repeat(43)),
    "A".repeat(43),
  );
  assert.equal(normalizeMembershipPresentationCode("A".repeat(42)), null);
  assert.equal(normalizeMembershipPresentationCode("!".repeat(43)), null);
});

test("member check-in snapshots reject leaked or inconsistent fields", () => {
  const snapshot = {
    activePeriod: {
      membershipPeriodId: periodId,
      planCode: "basic",
      includedCheckins: 10,
      includedCheckinsUsed: 1,
      heldCheckins: 1,
    },
    pendingArrival: {
      requestId,
      operationId,
      venueId,
      venueSlug: "northside-combat",
      venueName: "Northside Combat",
      reservationId: null,
      classSessionId: null,
      classTitle: null,
      serviceDate: "2026-09-28",
      status: "pending",
      createdAt: "2026-09-28T10:00:00.000Z",
      expiresAt: "2026-09-28T10:15:00.000Z",
    },
    history: [],
  };
  assert.equal(isMembershipCheckinSnapshot(snapshot), true);
  assert.equal(
    isMembershipCheckinSnapshot({
      ...snapshot,
      pendingArrival: {
        ...snapshot.pendingArrival,
        codeHash: "secret",
      },
    }),
    false,
  );
  assert.equal(
    isMembershipCheckinSnapshot({
      ...snapshot,
      activePeriod: {
        ...snapshot.activePeriod,
        planCode: "classic",
      },
    }),
    false,
  );
});
