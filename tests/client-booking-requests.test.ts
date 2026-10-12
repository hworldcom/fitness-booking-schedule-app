import assert from "node:assert/strict";
import test from "node:test";
import type { ClientCoachBookingRequestProjection } from "@/domain/coach-booking-requests";
import {
  clientBookingRequestGroups,
  clientBookingRequestStatusDescription,
  clientBookingRequestStatusLabel,
  mergeClientBookingRequestPages,
} from "@/features/profile/client-booking-request-model";

function request(
  id: string,
  status: ClientCoachBookingRequestProjection["status"],
  updatedAt: string,
): ClientCoachBookingRequestProjection {
  return Object.freeze({
    id,
    slotId: id.replace("91000000", "92000000"),
    coachProfileId: "93000000-0000-4000-8000-000000000001",
    coachDisplayName: "Test Coach",
    coachSlug: "test-coach",
    coachPortraitUrl: "/images/coaches/test-coach.webp",
    status,
    scheduledStartAt: "2026-10-13T10:00:00.000Z",
    scheduledEndAt: "2026-10-13T11:00:00.000Z",
    coachTimezone: "Europe/Berlin",
    location: Object.freeze({
      trainingLocationId: "94000000-0000-4000-8000-000000000001",
      name: "Test Gym",
      kind: "gym" as const,
      gymName: "Test Gym",
      publicLabel: "Test Gym — Berlin",
    }),
    decisionDeadlineAt: "2026-10-12T20:00:00.000Z",
    decidedAt: status === "pending" ? null : updatedAt,
    acceptedBookingId:
      status === "accepted" ? "95000000-0000-4000-8000-000000000001" : null,
    createdAt: "2026-10-12T08:00:00.000Z",
    updatedAt,
  });
}

test("client request pages deduplicate and keep pending requests first", () => {
  const terminal = request(
    "91000000-0000-4000-8000-000000000001",
    "declined",
    "2026-10-12T10:00:00.000Z",
  );
  const pending = request(
    "91000000-0000-4000-8000-000000000002",
    "pending",
    "2026-10-12T09:00:00.000Z",
  );
  const merged = mergeClientBookingRequestPages(
    [terminal],
    [terminal, pending],
  );
  const groups = clientBookingRequestGroups(merged);

  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.id, pending.id);
  assert.deepEqual(
    groups.pending.map((item) => item.id),
    [pending.id],
  );
  assert.deepEqual(
    groups.history.map((item) => item.id),
    [terminal.id],
  );
});

test("client request labels distinguish confirmation from unsuccessful outcomes", () => {
  assert.equal(
    clientBookingRequestStatusLabel("pending"),
    "Awaiting coach confirmation",
  );
  assert.equal(clientBookingRequestStatusLabel("accepted"), "Confirmed");
  assert.equal(clientBookingRequestStatusLabel("declined"), "Not confirmed");
  assert.equal(
    clientBookingRequestStatusLabel("not-selected"),
    "Not confirmed",
  );
  assert.equal(clientBookingRequestStatusLabel("withdrawn"), "Withdrawn");
  assert.equal(clientBookingRequestStatusLabel("expired"), "Expired");
  assert.equal(
    clientBookingRequestStatusLabel("occurrence-closed"),
    "Request closed",
  );
  assert.match(
    clientBookingRequestStatusDescription("pending"),
    /not confirmed/i,
  );
  assert.doesNotMatch(
    clientBookingRequestStatusDescription("not-selected"),
    /other|candidate|selected/i,
  );
});
