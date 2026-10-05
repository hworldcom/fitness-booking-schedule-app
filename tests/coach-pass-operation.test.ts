import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import {
  approveCoachPassOperation,
  prepareCoachPassOperationRequest,
  recoverCoachPassOperationRequest,
  signPreparedCoachPassOperation,
} from "../src/solana/client/coach-pass-client";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "../src/solana/coach-pass";
import {
  isCoachPassOperationApiResult,
  isCoachPassOperationIdRequest,
  isPrepareCoachPassOperationRequest,
  isSubmitCoachPassOperationRequest,
  type PreparedCoachPassOperationResult,
} from "../src/solana/coach-pass-operation";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const COACH_ID = "22222222-2222-4222-8222-222222222222";

async function preparedFixture(): Promise<PreparedCoachPassOperationResult> {
  const [authority, payer, coachAuthority, credits, offer, recipient, token] =
    await Promise.all([
      generateKeyPairSigner(),
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
        operation: "purchase-first-offer",
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        authorityAddress: authority.address,
        platformPayerAddress: payer.address,
        coachAuthorityAddress: coachAuthority.address,
        coachClientCreditsAddress: credits.address,
        creditReservationAddress: null,
        testAsset: "EURC",
        paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
        userPaysSol: false,
        offerAddress: offer.address,
        paymentRecipientAddress: recipient.address,
        priceEurcBaseUnits: "8000000",
        creditsPurchased: 1,
        expectedPurchaseNonce: "0",
        clientTokenAccountAddress: token.address,
        coachTokenAccountAddress: token.address,
      }),
      transactionBase64: Buffer.from([1, 2, 3]).toString("base64"),
      messageBase64: Buffer.from([4, 5, 6]).toString("base64"),
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: "1234",
    }),
    simulation: Object.freeze({ slot: "900", unitsConsumed: "12345" }),
  });
}

test("coach-pass request and response validators reject malformed boundaries", async () => {
  const prepared = await preparedFixture();
  assert.equal(
    isPrepareCoachPassOperationRequest({
      kind: "purchase",
      coachProfileId: COACH_ID,
      coachAuthorityAddress: prepared.prepared.summary.coachAuthorityAddress,
      offerAddress:
        prepared.prepared.summary.operation === "purchase-first-offer"
          ? prepared.prepared.summary.offerAddress
          : "",
    }),
    true,
  );
  assert.equal(
    isPrepareCoachPassOperationRequest({ kind: "booking", operationId: "bad" }),
    false,
  );
  assert.equal(
    isCoachPassOperationIdRequest({ operationId: OPERATION_ID }),
    true,
  );
  assert.equal(
    isSubmitCoachPassOperationRequest({
      operationId: OPERATION_ID,
      walletSignedTransactionBase64: "***",
    }),
    false,
  );
  assert.equal(isCoachPassOperationApiResult(prepared), true);
  assert.equal(
    isCoachPassOperationApiResult({
      ...prepared,
      prepared: {
        ...prepared.prepared,
        summary: {
          ...prepared.prepared.summary,
          priceEurcBaseUnits: "0",
        },
      },
    }),
    false,
  );
  assert.equal(
    isCoachPassOperationApiResult({ ...prepared, simulation: { slot: -1 } }),
    false,
  );
});

test("browser signing forwards exact bytes and finalized simulation slot", async () => {
  const prepared = await preparedFixture();
  let observedBytes: Uint8Array | null = null;
  let observedSlot: bigint | undefined;
  const signedBase64 = await signPreparedCoachPassOperation(
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

test("browser API adapter posts same-origin JSON and validates responses", async () => {
  const prepared = await preparedFixture();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(prepared);
  };
  const result = await prepareCoachPassOperationRequest(
    { kind: "booking", operationId: OPERATION_ID },
    fetcher,
  );
  assert.equal(result.status, "prepared");
  assert.equal(calls[0]?.url, "/api/solana/coach-pass/prepare");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.credentials, "same-origin");

  const invalidFetcher: typeof fetch = async () => Response.json({ ok: true });
  await assert.rejects(
    recoverCoachPassOperationRequest(OPERATION_ID, invalidFetcher),
    /invalid response/u,
  );
});

test("approval submits only the wallet-returned signed transaction", async () => {
  const prepared = await preparedFixture();
  let submitted: unknown;
  const fetcher: typeof fetch = async (_input, init) => {
    submitted = JSON.parse(String(init?.body));
    return Response.json({
      status: "submitted",
      operationId: OPERATION_ID,
      operation: "purchase-first-offer",
      transactionSignature:
        "11111111111111111111111111111111111111111111111111111111111111111111111111111111",
      failureCode: null,
      finalizedSlot: null,
    });
  };
  const result = await approveCoachPassOperation(
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
