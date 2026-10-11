import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptPrivateSessionRequestAction,
  closePrivateSessionOccurrenceAction,
  declinePrivateSessionRequestAction,
  requestPrivateSessionAction,
  withdrawPrivateSessionRequestAction,
} from "@/app/coach-marketplace-actions";

test("booking-request actions reject malformed public identifiers", async () => {
  const results = await Promise.all([
    requestPrivateSessionAction("not-an-occurrence"),
    withdrawPrivateSessionRequestAction("not-a-request"),
    declinePrivateSessionRequestAction("not-a-request"),
    acceptPrivateSessionRequestAction("not-a-request"),
    closePrivateSessionOccurrenceAction("not-an-occurrence"),
  ]);

  assert.ok(results.every((result) => result.status === "invalid"));
  assert.ok(results.every((result) => result.bookingId === undefined));
  assert.ok(results.every((result) => result.requestId === undefined));
});
