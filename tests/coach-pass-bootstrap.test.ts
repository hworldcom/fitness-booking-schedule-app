import assert from "node:assert/strict";
import test from "node:test";
import { blockhash, generateKeyPairSigner } from "@solana/kit";
import {
  isCoachPassBootstrapApiResult,
  isPreparedCoachPassBootstrapTransaction,
  isSubmitCoachPassBootstrapRequest,
  type PreparedCoachPassBootstrapResult,
} from "../src/solana/coach-pass-bootstrap";
import {
  prepareCoachPassBootstrapRequest,
  signCoachPassBootstrapTransaction,
  submitSignedCoachPassBootstrap,
} from "../src/solana/client/coach-pass-bootstrap-client";
import { MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS } from "../src/solana/coach-pass";
import { prepareCoachPassBootstrap } from "../src/solana/coach-pass-transaction";

async function fixture(): Promise<PreparedCoachPassBootstrapResult> {
  const [coach, recovery, payer] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const prepared = await prepareCoachPassBootstrap({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: payer.address,
    lifetimeConstraint: {
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: BigInt(1_234),
    },
    runId: "11111111-1111-4111-8111-111111111111",
    profileId: "22222222-2222-4222-8222-222222222222",
    coachWalletAddress: coach.address,
    recoveryAuthorityAddress: recovery.address,
    oneCreditPriceEurcBaseUnits: BigInt(10_000_000),
    tenCreditPriceEurcBaseUnits: BigInt(100_000_000),
  });
  return Object.freeze({
    status: "prepared",
    prepared,
    simulation: Object.freeze({ slot: "900", unitsConsumed: "49137" }),
  });
}

test("bootstrap boundary accepts only the frozen zero-EURC transaction shape", async () => {
  const result = await fixture();
  assert.equal(isPreparedCoachPassBootstrapTransaction(result.prepared), true);
  assert.equal(isCoachPassBootstrapApiResult(result), true);
  assert.equal(
    isSubmitCoachPassBootstrapRequest({
      prepared: result.prepared,
      walletSignedTransactionBase64: result.prepared.transactionBase64,
    }),
    true,
  );
  assert.equal(
    isPreparedCoachPassBootstrapTransaction({
      ...result.prepared,
      summary: { ...result.prepared.summary, eurcMovedBaseUnits: "1" },
    }),
    false,
  );
  assert.equal(
    isPreparedCoachPassBootstrapTransaction({
      ...result.prepared,
      summary: {
        ...result.prepared.summary,
        oneCreditPriceEurcBaseUnits: "0",
      },
    }),
    false,
  );
  assert.equal(
    isSubmitCoachPassBootstrapRequest({
      prepared: result.prepared,
      walletSignedTransactionBase64: "***",
    }),
    false,
  );
});

test("bootstrap browser signing preserves exact bytes and simulation slot", async () => {
  const result = await fixture();
  let transactionByteLength = 0;
  let minContextSlot: bigint | undefined;
  const signed = await signCoachPassBootstrapTransaction(
    result.prepared.transactionBase64,
    result.simulation.slot,
    async (input) => {
      transactionByteLength = input.transaction.byteLength;
      minContextSlot = input.options?.minContextSlot;
      return { signedTransaction: Uint8Array.from([9, 8, 7]) };
    },
  );
  assert.equal(transactionByteLength, 648);
  assert.equal(minContextSlot, BigInt(900));
  assert.equal(signed, Buffer.from([9, 8, 7]).toString("base64"));
});

test("bootstrap browser API uses same-origin prepare and exact signed submit", async () => {
  const prepared = await fixture();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(
      calls.length === 1
        ? prepared
        : {
            status: "submitted",
            transactionSignature: "1".repeat(88),
            finalizedSlot: null,
          },
    );
  };
  assert.equal(
    (await prepareCoachPassBootstrapRequest(fetcher)).status,
    "prepared",
  );
  const submitted = await submitSignedCoachPassBootstrap(
    prepared,
    prepared.prepared.transactionBase64,
    fetcher,
  );
  assert.equal(submitted.status, "submitted");
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/solana/coach-pass/bootstrap/prepare",
      "/api/solana/coach-pass/bootstrap/submit",
    ],
  );
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  const body = JSON.parse(String(calls[1]?.init?.body)) as Record<
    string,
    unknown
  >;
  assert.equal(
    body.walletSignedTransactionBase64,
    prepared.prepared.transactionBase64,
  );
});
