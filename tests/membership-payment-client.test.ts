import assert from "node:assert/strict";
import test from "node:test";
import {
  address,
  blockhash,
  createTransactionMessage,
  getBase58Decoder,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type SignatureBytes,
  type TransactionSigner,
} from "@solana/kit";
import {
  approveAndBroadcastMembershipPayment,
  MembershipPaymentClientError,
  type PreparedMembershipPaymentTransaction,
} from "@/solana/client/membership-payment-client";

const walletAddress = address("3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe");
const sourceTokenAddress = address(
  "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
);
const signatureBytes = new Uint8Array(64).fill(7) as SignatureBytes;

function preparedPayment(
  signer: TransactionSigner,
): PreparedMembershipPaymentTransaction {
  return {
    transactionMessage: setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: blockhash("11111111111111111111111111111111"),
        lastValidBlockHeight: BigInt(10),
      },
      setTransactionMessageFeePayerSigner(
        signer,
        createTransactionMessage({ version: "legacy" }),
      ),
    ),
    sourceTokenAddress,
    unitsConsumed: null,
  } as unknown as PreparedMembershipPaymentTransaction;
}

test("membership approval uses the wallet sign-and-send capability", async () => {
  let signOnlyCalls = 0;
  let signAndSendCalls = 0;
  const signer = {
    address: walletAddress,
    async modifyAndSignTransactions() {
      signOnlyCalls += 1;
      throw new Error("sign-only must not be used");
    },
    async signAndSendTransactions(transactions: readonly unknown[]) {
      signAndSendCalls += 1;
      assert.equal(transactions.length, 1);
      return [signatureBytes];
    },
  } as TransactionSigner;

  const result = await approveAndBroadcastMembershipPayment({
    prepared: preparedPayment(signer),
  });

  assert.equal(signOnlyCalls, 0);
  assert.equal(signAndSendCalls, 1);
  assert.equal(result.signature, getBase58Decoder().decode(signatureBytes));
});

test("membership approval preserves an explicit wallet cancellation", async () => {
  const signer = {
    address: walletAddress,
    async signAndSendTransactions() {
      throw Object.assign(new Error("cancelled"), { code: 4001 });
    },
  } as TransactionSigner;

  await assert.rejects(
    approveAndBroadcastMembershipPayment({
      prepared: preparedPayment(signer),
    }),
    (error) =>
      error instanceof MembershipPaymentClientError &&
      error.code === "wallet-cancelled",
  );
});

test("membership approval treats an unknown wallet result as recoverable", async () => {
  const signer = {
    address: walletAddress,
    async signAndSendTransactions() {
      throw new Error("wallet response lost");
    },
  } as TransactionSigner;

  await assert.rejects(
    approveAndBroadcastMembershipPayment({
      prepared: preparedPayment(signer),
    }),
    (error) =>
      error instanceof MembershipPaymentClientError &&
      error.code === "broadcast-failed",
  );
});
