import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GroupEventActorState } from "@/domain/group-event-marketplace";
import type { GroupEventProjection } from "@/domain/group-events";
import { GroupEventCatalogue } from "@/features/group-events/group-event-catalogue";
import { GroupEventDetail } from "@/features/group-events/group-event-detail";
import {
  decodeStoredGroupEventOperation,
  encodeStoredGroupEventOperation,
  groupEventPreparationStatusMessage,
} from "@/features/group-events/group-event-operation-panel";
import { groupEventOperationStatusMessage } from "@/features/group-events/group-event-operation-review";

function publishedEvent(): GroupEventProjection {
  return Object.freeze({
    id: "99000000-0000-4000-8000-000000000001",
    slug: "community-boxing-workshop",
    coachProfileId: "99000000-0000-4000-8000-000000000002",
    title: "Community boxing workshop",
    discipline: "Boxing",
    description:
      "A structured community workshop with technical rounds and clear progressions for mixed experience levels.",
    coach: Object.freeze({ slug: "coach-maya", displayName: "Coach Maya" }),
    location: Object.freeze({
      kind: "gym",
      label: "Kreuzberg Training Hall",
      timezone: "Europe/Berlin",
      latitude: 52.5,
      longitude: 13.4,
    }),
    startsAt: "2026-12-20T11:00:00.000Z",
    endsAt: "2026-12-20T13:00:00.000Z",
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
      lifecycleStatus: "funding",
      transactionSignature: "2".repeat(88),
      observedSlot: BigInt(1),
      finalizedAt: "2026-12-01T10:00:00.000Z",
    }),
  });
}

test("catalogue presents exact price, threshold progress and detail link", () => {
  const html = renderToStaticMarkup(
    createElement(GroupEventCatalogue, { events: [publishedEvent()] }),
  );
  assert.match(html, /Community boxing workshop/u);
  assert.match(html, /2 of 4 needed/u);
  assert.match(html, /25 test EURC/u);
  assert.match(html, /aria-valuenow="50"/u);
  assert.match(html, /href="\/events\/community-boxing-workshop"/u);
});

test("public detail explains conditional funding without exposing guest wallet actions", () => {
  const actor: GroupEventActorState = Object.freeze({ status: "signed-out" });
  const html = renderToStaticMarkup(
    createElement(GroupEventDetail, {
      event: publishedEvent(),
      actor,
      now: new Date("2026-12-10T12:00:00.000Z").getTime(),
    }),
  );
  assert.match(html, /25 test EURC/u);
  assert.match(html, /full seat refund/u);
  assert.match(html, /Sign in to fund or settle/u);
  assert.match(
    html,
    /href="\/sign-in\?returnTo=%2Fevents%2Fcommunity-boxing-workshop"/u,
  );
  assert.doesNotMatch(html, /Review one-seat funding/u);
  assert.match(html, /SOL fees and rent/u);
});

test("submitted and rejected operation copy never claims finality", () => {
  assert.match(
    groupEventOperationStatusMessage({
      status: "submitted",
      operationId: "99000000-0000-4000-8000-000000000001",
      operation: "fund-event-seat",
      transactionSignature: "2".repeat(88),
      failureCode: null,
      finalizedSlot: null,
    }),
    /recover the result/u,
  );
  assert.match(
    groupEventOperationStatusMessage({
      status: "failed",
      operationId: "99000000-0000-4000-8000-000000000001",
      operation: "fund-event-seat",
      transactionSignature: null,
      failureCode: "wallet-rejected",
      finalizedSlot: null,
    }),
    /No replacement transaction was sent/u,
  );
  assert.match(
    groupEventPreparationStatusMessage(
      { status: "conflict" },
      {
        kind: "fund",
        eventId: "99000000-0000-4000-8000-000000000001",
      },
    ),
    /test-EURC account\/balance.*no transaction was sent/iu,
  );
  assert.match(
    groupEventOperationStatusMessage({
      status: "invalid-request",
      reason: "wallet-message-mismatch",
    }),
    /wallet changed the reviewed transaction message.*nothing was submitted/iu,
  );
});

test("reload recovery preserves the exact reviewed request and rejects event drift", () => {
  const operationId = "99000000-0000-4000-8000-000000000099";
  const request = {
    kind: "create" as const,
    eventId: "99000000-0000-4000-8000-000000000001",
    coachAuthorityAddress: "11111111111111111111111111111111",
    seatPriceEurcBaseUnits: "25000000",
    minimumParticipants: 4,
    maximumParticipants: 12,
    fundingDeadline: "2026-12-15T17:00:00.000Z",
  };
  const encoded = encodeStoredGroupEventOperation(operationId, request);
  assert.deepEqual(decodeStoredGroupEventOperation(encoded, request.eventId), {
    operationId,
    request,
  });
  assert.equal(
    decodeStoredGroupEventOperation(
      encoded,
      "99000000-0000-4000-8000-000000000002",
    ),
    null,
  );
  assert.deepEqual(
    decodeStoredGroupEventOperation(operationId, request.eventId),
    {
      operationId,
      request: null,
    },
  );
});
