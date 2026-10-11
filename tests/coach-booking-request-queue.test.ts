import assert from "node:assert/strict";
import test from "node:test";
import type { OwnedCoachBookingRequestProjection } from "@/domain/coach-booking-requests";
import {
  coachBookingRequestStatusLabel,
  groupCoachBookingRequestsByOccurrence,
  mergeCoachBookingRequestPages,
} from "@/features/coaches/coach-booking-request-queue-model";

const SLOT_ONE = "97000000-0000-4000-8000-000000000001";
const SLOT_TWO = "97000000-0000-4000-8000-000000000002";

function request(
  id: string,
  slotId: string,
  status: OwnedCoachBookingRequestProjection["status"],
  scheduledStartAt: string,
  createdAt: string,
): OwnedCoachBookingRequestProjection {
  return Object.freeze({
    id,
    slotId,
    clientProfileId: id.replace("97000000", "98000000"),
    clientDisplayName: `Client ${id.at(-1)}`,
    status,
    scheduledStartAt,
    scheduledEndAt: new Date(
      new Date(scheduledStartAt).getTime() + 60 * 60 * 1000,
    ).toISOString(),
    coachTimezone: "Europe/Berlin",
    location: Object.freeze({
      trainingLocationId: "40000000-0000-4000-8000-000000000001",
      name: "Test Gym",
      kind: "gym" as const,
      gymName: "Test Gym",
      publicLabel: "Test Gym — Berlin",
    }),
    decisionDeadlineAt: "2026-10-12T08:00:00.000Z",
    decidedAt: status === "pending" ? null : "2026-10-11T21:00:00.000Z",
    acceptedBookingId:
      status === "accepted" ? "99000000-0000-4000-8000-000000000001" : null,
    createdAt,
    updatedAt: status === "pending" ? createdAt : "2026-10-11T21:00:00.000Z",
  });
}

test("request pages deduplicate and merge candidates into occurrence groups", () => {
  const first = request(
    "97000000-0000-4000-8000-000000000011",
    SLOT_ONE,
    "pending",
    "2026-10-12T10:00:00.000Z",
    "2026-10-11T20:00:00.000Z",
  );
  const second = request(
    "97000000-0000-4000-8000-000000000012",
    SLOT_ONE,
    "pending",
    "2026-10-12T10:00:00.000Z",
    "2026-10-11T19:00:00.000Z",
  );

  const merged = mergeCoachBookingRequestPages([first], [first, second]);
  const groups = groupCoachBookingRequestsByOccurrence(merged);
  assert.equal(merged.length, 2);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.slotId, SLOT_ONE);
  assert.equal(groups[0]?.pendingCount, 2);
  assert.deepEqual(
    groups[0]?.requests.map((candidate) => candidate.id),
    [first.id, second.id],
  );
});

test("pending occurrences precede read-only terminal request history", () => {
  const terminal = request(
    "97000000-0000-4000-8000-000000000021",
    SLOT_ONE,
    "declined",
    "2026-10-12T09:00:00.000Z",
    "2026-10-11T21:00:00.000Z",
  );
  const laterPending = request(
    "97000000-0000-4000-8000-000000000022",
    SLOT_TWO,
    "pending",
    "2026-10-12T11:00:00.000Z",
    "2026-10-11T18:00:00.000Z",
  );

  const groups = groupCoachBookingRequestsByOccurrence([
    terminal,
    laterPending,
  ]);
  assert.deepEqual(
    groups.map((group) => group.slotId),
    [SLOT_TWO, SLOT_ONE],
  );
  assert.equal(groups[0]?.pendingCount, 1);
  assert.equal(groups[1]?.pendingCount, 0);
});

test("terminal request labels describe ended attempts, not completed training", () => {
  assert.equal(coachBookingRequestStatusLabel("accepted"), "Accepted");
  assert.equal(
    coachBookingRequestStatusLabel("withdrawn"),
    "Withdrawn by client",
  );
  assert.equal(coachBookingRequestStatusLabel("expired"), "Expired");
  assert.equal(coachBookingRequestStatusLabel("not-selected"), "Not selected");
  assert.equal(
    coachBookingRequestStatusLabel("occurrence-closed"),
    "Occurrence closed",
  );
});
