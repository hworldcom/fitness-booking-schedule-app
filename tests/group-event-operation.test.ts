import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import {
  approveGroupEventOperation,
  prepareGroupEventOperationRequest,
  recoverGroupEventOperationRequest,
  signPreparedGroupEventOperation,
} from "../src/solana/client/group-event-client";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "../src/solana/coach-pass";
import {
  isGroupEventOperationApiResult,
  isGroupEventOperationIdRequest,
  isPrepareGroupEventOperationRequest,
  isPreparedGroupEventTransaction,
  isSubmitGroupEventOperationRequest,
  type PreparedGroupEventOperationResult,
} from "../src/solana/group-event-operation";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

async function preparedFixture(): Promise<PreparedGroupEventOperationResult> {
  const [authority, payer, pool, vault, coachAuthority, recipient] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  return Object.freeze({
    status: "prepared",
    operationId: OPERATION_ID,
    prepared: Object.freeze({
      summary: Object.freeze({
        cluster: "devnet",
        operation: "create-event-pool",
        eventId: EVENT_ID,
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        authorityAddress: authority.address,
        platformPayerAddress: payer.address,
        eventPoolAddress: pool.address,
        vaultAddress: vault.address,
        coachAuthorityAddress: coachAuthority.address,
        contributionAddress: null,
        testAsset: "EURC",
        paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
        userPaysSol: false,
        payoutRecipientAddress: recipient.address,
        nonce: "9",
        seatPriceEurcBaseUnits: "25000000",
        minimumParticipants: 2,
        maximumParticipants: 8,
        fundingDeadlineUnixSeconds: "1900003600",
        eventStartUnixSeconds: "1900007200",
        eventEndUnixSeconds: "1900010800",
      }),
      transactionBase64: Buffer.from([1, 2, 3]).toString("base64"),
      messageBase64: Buffer.from([4, 5, 6]).toString("base64"),
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: "1234",
    }),
    simulation: Object.freeze({ slot: "900", unitsConsumed: "12345" }),
  });
}

test("group-event request and response guards reject malformed financial boundaries", async () => {
  const prepared = await preparedFixture();
  assert.equal(
    isPrepareGroupEventOperationRequest({
      kind: "create",
      eventId: EVENT_ID,
      coachAuthorityAddress: prepared.prepared.summary.coachAuthorityAddress,
      seatPriceEurcBaseUnits: "25000000",
      minimumParticipants: 2,
      maximumParticipants: 8,
      fundingDeadline: "2030-03-17T18:46:40.000Z",
    }),
    true,
  );
  assert.equal(
    isPrepareGroupEventOperationRequest({ kind: "fund", eventId: EVENT_ID }),
    true,
  );
  assert.equal(
    isPrepareGroupEventOperationRequest({
      kind: "create",
      eventId: EVENT_ID,
      coachAuthorityAddress: prepared.prepared.summary.coachAuthorityAddress,
      seatPriceEurcBaseUnits: "0",
      minimumParticipants: 1,
      maximumParticipants: 51,
      fundingDeadline: "bad",
    }),
    false,
  );
  assert.equal(
    isGroupEventOperationIdRequest({ operationId: OPERATION_ID }),
    true,
  );
  assert.equal(
    isSubmitGroupEventOperationRequest({
      operationId: OPERATION_ID,
      walletSignedTransactionBase64: "***",
    }),
    false,
  );
  assert.equal(isPreparedGroupEventTransaction(prepared.prepared), true);
  assert.equal(isGroupEventOperationApiResult(prepared), true);
  assert.equal(
    isGroupEventOperationApiResult({
      ...prepared,
      prepared: {
        ...prepared.prepared,
        summary: {
          ...prepared.prepared.summary,
          userPaysSol: true,
        },
      },
    }),
    false,
  );
});

test("group-event browser signing forwards exact bytes and simulation slot", async () => {
  const prepared = await preparedFixture();
  let observedBytes: Uint8Array | null = null;
  let observedSlot: bigint | undefined;
  const signedBase64 = await signPreparedGroupEventOperation(
    prepared,
    async ({ transaction, options }) => {
      observedBytes = transaction;
      observedSlot = options?.minContextSlot;
      return { signedTransaction: Uint8Array.from([9, 8, 7]) };
    },
  );
  assert.deepEqual(Array.from(observedBytes ?? []), [1, 2, 3]);
  assert.equal(observedSlot, BigInt(900));
  assert.equal(signedBase64, Buffer.from([9, 8, 7]).toString("base64"));
});

test("group-event browser adapter uses same-origin JSON and validates replies", async () => {
  const prepared = await preparedFixture();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(prepared);
  };
  const result = await prepareGroupEventOperationRequest(
    { kind: "fund", eventId: EVENT_ID },
    fetcher,
  );
  assert.equal(result.status, "prepared");
  assert.equal(calls[0]?.url, "/api/solana/group-events/prepare");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.credentials, "same-origin");

  const invalidFetcher: typeof fetch = async () => Response.json({ ok: true });
  await assert.rejects(
    recoverGroupEventOperationRequest(OPERATION_ID, invalidFetcher),
    /invalid response/u,
  );
});

test("group-event approval submits only wallet-returned transaction bytes", async () => {
  const prepared = await preparedFixture();
  let submitted: unknown;
  const fetcher: typeof fetch = async (_input, init) => {
    submitted = JSON.parse(String(init?.body));
    return Response.json({
      status: "submitted",
      operationId: OPERATION_ID,
      operation: "create-event-pool",
      transactionSignature:
        "11111111111111111111111111111111111111111111111111111111111111111111111111111111",
      failureCode: null,
      finalizedSlot: null,
    });
  };
  const result = await approveGroupEventOperation(
    prepared,
    async () => ({ signedTransaction: Uint8Array.from([9, 8, 7]) }),
    fetcher,
  );
  assert.equal(result.status, "submitted");
  assert.deepEqual(submitted, {
    operationId: OPERATION_ID,
    walletSignedTransactionBase64: Buffer.from([9, 8, 7]).toString("base64"),
  });
});
