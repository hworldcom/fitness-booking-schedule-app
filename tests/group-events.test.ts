import assert from "node:assert/strict";
import test from "node:test";
import {
  GROUP_EVENT_MAXIMUM_PARTICIPANTS,
  parseGroupEventDraftInput,
  validateVerifiedGroupEventContributionProjection,
  validateVerifiedGroupEventPoolProjection,
} from "@/domain/group-events";

const eventId = "99000000-0000-4000-8000-000000000001";
const address = "7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge";
const secondAddress = "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe";
const signature = "2".repeat(88);
const now = new Date("2026-10-04T10:00:00.000Z");

test("group-event drafts normalize bounded metadata and reject invalid schedules", () => {
  const valid = parseGroupEventDraftInput(
    {
      title: "  Muay Thai   Workshop ",
      discipline: "Muay Thai",
      description:
        " A technical workshop with structured rounds and a clear progression. ",
      startsAt: "2026-10-20T10:00:00.000Z",
      endsAt: "2026-10-20T12:00:00.000Z",
      mediaUrl: "/images/group-events/muay-thai.jpg",
      sourceProposalId: null,
    },
    now,
  );
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.value.title, "Muay Thai Workshop");
    assert.equal(valid.value.startsAt, "2026-10-20T10:00:00.000Z");
  }

  assert.equal(
    parseGroupEventDraftInput(
      {
        title: "Short event",
        discipline: "Boxing",
        description: "A sufficiently descriptive event summary.",
        startsAt: "2026-10-20T10:00:00.000Z",
        endsAt: "2026-10-20T10:29:00.000Z",
      },
      now,
    ).valid,
    false,
  );
  assert.equal(
    parseGroupEventDraftInput(
      {
        title: "Past event",
        discipline: "Boxing",
        description: "A sufficiently descriptive event summary.",
        startsAt: "2026-10-03T10:00:00.000Z",
        endsAt: "2026-10-03T11:00:00.000Z",
      },
      now,
    ).valid,
    false,
  );
});

test("verified pool evidence enforces exact bounded financial terms", () => {
  const evidence = Object.freeze({
    eventId,
    programAddress: address,
    eventPoolAddress: secondAddress,
    vaultAddress: address,
    coachAuthorityAddress: address,
    payoutRecipientAddress: address,
    mintAddress: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    tokenProgramAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    seatPriceBaseUnits: BigInt(25_000_000),
    minimumParticipants: 4,
    maximumParticipants: 12,
    participantCount: 4,
    fundingDeadline: "2026-10-19T10:00:00.000Z",
    eventStartsAt: "2026-10-20T10:00:00.000Z",
    eventEndsAt: "2026-10-20T12:00:00.000Z",
    lifecycleStatus: "succeeded" as const,
    transactionSignature: signature,
    observedSlot: BigInt(42),
    finalizedAt: "2026-10-19T10:01:00.000Z",
  });
  assert.equal(validateVerifiedGroupEventPoolProjection(evidence), true);
  assert.equal(
    validateVerifiedGroupEventPoolProjection({
      ...evidence,
      maximumParticipants: GROUP_EVENT_MAXIMUM_PARTICIPANTS + 1,
    }),
    false,
  );
  assert.equal(
    validateVerifiedGroupEventPoolProjection({
      ...evidence,
      mintAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    }),
    false,
  );
  assert.equal(
    validateVerifiedGroupEventPoolProjection({
      ...evidence,
      tokenProgramAddress: secondAddress,
    }),
    false,
  );
  assert.equal(
    validateVerifiedGroupEventPoolProjection({
      ...evidence,
      lifecycleStatus: "failed",
    }),
    false,
  );
});

test("verified contribution evidence remains one exact finalized chain projection", () => {
  const evidence = Object.freeze({
    eventId,
    programAddress: address,
    eventPoolAddress: secondAddress,
    contributionAddress: address,
    participantWalletAddress: secondAddress,
    amountBaseUnits: BigInt(25_000_000),
    lifecycleStatus: "funded" as const,
    transactionSignature: signature,
    observedSlot: BigInt(50),
    finalizedAt: "2026-10-19T09:00:00.000Z",
  });
  assert.equal(
    validateVerifiedGroupEventContributionProjection(evidence),
    true,
  );
  assert.equal(
    validateVerifiedGroupEventContributionProjection({
      ...evidence,
      participantWalletAddress: "not-a-wallet",
    }),
    false,
  );
});
