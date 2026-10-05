import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGroupEventActions,
  eurcToBaseUnits,
  groupEventProgress,
  parseGroupEventPoolTerms,
  zonedLocalDateTimeToIso,
  type GroupEventActorState,
} from "@/domain/group-event-marketplace";
import type {
  GroupEventPoolLifecycle,
  GroupEventProjection,
} from "@/domain/group-events";

function eventWithPool(
  lifecycleStatus: GroupEventPoolLifecycle,
  input: Partial<NonNullable<GroupEventProjection["pool"]>> = {},
): GroupEventProjection {
  return Object.freeze({
    id: "99000000-0000-4000-8000-000000000001",
    slug: "event",
    coachProfileId: "99000000-0000-4000-8000-000000000002",
    title: "Group event",
    discipline: "Boxing",
    description: "A sufficiently detailed group event description for testing.",
    coach: Object.freeze({ slug: "coach", displayName: "Coach" }),
    location: Object.freeze({
      kind: "gym",
      label: "Gym",
      timezone: "Europe/Berlin",
      latitude: 52.5,
      longitude: 13.4,
    }),
    startsAt: "2026-12-20T11:00:00.000Z",
    endsAt: "2026-12-20T12:00:00.000Z",
    mediaUrl: null,
    sourceProposalId: null,
    publicationStatus: "published",
    projectionAvailability: "current",
    projectionStatusUpdatedAt: "2026-12-01T10:00:00.000Z",
    programAddress: "11111111111111111111111111111111",
    eventPoolAddress: "11111111111111111111111111111111",
    pool: Object.freeze({
      programAddress: "11111111111111111111111111111111",
      eventPoolAddress: "11111111111111111111111111111111",
      vaultAddress: "11111111111111111111111111111111",
      coachAuthorityAddress: "11111111111111111111111111111111",
      payoutRecipientAddress: "11111111111111111111111111111111",
      mintAddress: "11111111111111111111111111111111",
      tokenProgramAddress: "11111111111111111111111111111111",
      seatPriceBaseUnits: BigInt(25_000_000),
      minimumParticipants: 4,
      maximumParticipants: 12,
      participantCount: 2,
      fundingDeadline: "2026-12-15T12:00:00.000Z",
      lifecycleStatus,
      transactionSignature: "2".repeat(88),
      observedSlot: BigInt(1),
      finalizedAt: "2026-12-01T10:00:00.000Z",
      ...input,
    }),
  });
}

const participant: GroupEventActorState = Object.freeze({
  status: "authorized",
  isCoach: false,
  contribution: null,
});

test("coach-local date times convert to exact instants and reject DST gaps", () => {
  assert.equal(
    zonedLocalDateTimeToIso("2026-12-20T12:30", "Europe/Berlin"),
    "2026-12-20T11:30:00.000Z",
  );
  assert.equal(
    zonedLocalDateTimeToIso("2026-07-20T12:30", "Europe/Berlin"),
    "2026-07-20T10:30:00.000Z",
  );
  assert.throws(
    () => zonedLocalDateTimeToIso("2026-03-29T02:30", "Europe/Berlin"),
    /does not exist/u,
  );
  assert.throws(
    () => zonedLocalDateTimeToIso("2026-02-30T12:00", "Europe/Berlin"),
    /valid local date/u,
  );
});

test("EURC input becomes exact six-decimal base units", () => {
  assert.equal(eurcToBaseUnits("25"), "25000000");
  assert.equal(eurcToBaseUnits("0.000001"), "1");
  assert.equal(eurcToBaseUnits("10.250000"), "10250000");
  assert.throws(() => eurcToBaseUnits("0"), /positive/u);
  assert.throws(() => eurcToBaseUnits("1.0000001"), /6 decimals/u);
  assert.throws(() => eurcToBaseUnits("9000000001"), /event limit/u);
});

test("pool review freezes bounded participants and a coach-local deadline", () => {
  assert.deepEqual(
    parseGroupEventPoolTerms(
      {
        seatPriceEurc: "25.50",
        minimumParticipants: 4,
        maximumParticipants: 12,
        fundingDeadlineLocal: "2026-12-15T18:00",
        timeZone: "Europe/Berlin",
        eventStartsAt: "2026-12-20T11:00:00.000Z",
      },
      new Date("2026-12-10T12:00:00.000Z"),
    ),
    {
      seatPriceEurcBaseUnits: "25500000",
      minimumParticipants: 4,
      maximumParticipants: 12,
      fundingDeadline: "2026-12-15T17:00:00.000Z",
    },
  );
  assert.throws(
    () =>
      parseGroupEventPoolTerms(
        {
          seatPriceEurc: "25",
          minimumParticipants: 1,
          maximumParticipants: 51,
          fundingDeadlineLocal: "2026-12-21T18:00",
          timeZone: "Europe/Berlin",
          eventStartsAt: "2026-12-20T11:00:00.000Z",
        },
        new Date("2026-12-10T12:00:00.000Z"),
      ),
    /2–50 participants/u,
  );
});

test("event actions follow finalized pool role and contribution state", () => {
  const beforeDeadline = new Date("2026-12-10T12:00:00.000Z");
  const afterDeadline = new Date("2026-12-16T12:00:00.000Z");
  assert.deepEqual(
    availableGroupEventActions(
      eventWithPool("funding"),
      participant,
      beforeDeadline,
    ),
    ["fund"],
  );
  assert.deepEqual(
    availableGroupEventActions(
      eventWithPool("funding"),
      { ...participant, isCoach: true },
      beforeDeadline,
    ),
    [],
  );
  assert.deepEqual(
    availableGroupEventActions(
      eventWithPool("funding"),
      participant,
      afterDeadline,
    ),
    ["settle"],
  );
  assert.deepEqual(
    availableGroupEventActions(
      eventWithPool("succeeded"),
      { ...participant, isCoach: true },
      afterDeadline,
    ),
    ["payout"],
  );
  assert.deepEqual(
    availableGroupEventActions(
      eventWithPool("failed"),
      {
        ...participant,
        contribution: {
          contributionAddress: "11111111111111111111111111111111",
          participantWalletAddress: "11111111111111111111111111111111",
          amountBaseUnits: "25000000",
          lifecycleStatus: "funded",
          transactionSignature: "2".repeat(88),
          finalizedAt: "2026-12-16T12:00:00.000Z",
        },
      },
      afterDeadline,
    ),
    ["refund"],
  );
});

test("funding progress is measured against the minimum and capped", () => {
  assert.deepEqual(groupEventProgress(eventWithPool("funding")), {
    percent: 50,
    label: "2 of 4 needed",
  });
  assert.equal(
    groupEventProgress(eventWithPool("succeeded", { participantCount: 8 }))
      .percent,
    100,
  );
});
