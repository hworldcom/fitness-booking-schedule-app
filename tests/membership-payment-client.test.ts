import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  blockhash,
  createNoopSigner,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type SignatureBytes,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";
import {
  approveAndBroadcastMembershipPayment,
  MembershipPaymentClientError,
  prepareMembershipPaymentTransaction,
  type PreparedMembershipPaymentTransaction,
} from "@/solana/client/membership-payment-client";
import type { MembershipPaymentQuote } from "@/solana/membership-payment";

const walletAddress = address("3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe");
const sourceTokenAddress = address(
  "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
);
const sponsorAddress = address("AjrQdXjR9y7B4oniU5TT7PTuiqubySQuvEDJaabkJP8C");
const signatureBytes = new Uint8Array(64).fill(7) as SignatureBytes;
const operationId = "19d99d55-fd32-4cc0-b7b8-2ed0f8f6590a";
const quote: MembershipPaymentQuote = {
  cluster: "solana:devnet",
  currency: "EURC",
  amountBaseUnits: "80000000",
  walletAddress,
  destinationOwnerAddress: "3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL",
  destinationTokenAddress: "BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8",
  mintAddress: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
  tokenProgramAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  tokenDecimals: 6,
  referenceAddress: "7XSYYtP2XWWV9jFNVt5tMqtmPWomCeGFmyJMN7JkHr92",
  memo: `movx-membership:v1:${operationId}`,
};

async function sponsoredWireTransaction() {
  const sponsor = await generateKeyPairSigner();
  const member = createNoopSigner(walletAddress);
  const message = appendTransactionMessageInstruction(
    {
      programAddress: address("11111111111111111111111111111111"),
      accounts: [
        {
          address: member.address,
          role: AccountRole.READONLY_SIGNER,
          signer: member,
        },
      ],
    },
    setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: blockhash("11111111111111111111111111111111"),
        lastValidBlockHeight: BigInt(10),
      },
      setTransactionMessageFeePayerSigner(
        sponsor,
        createTransactionMessage({ version: "legacy" }),
      ),
    ),
  );
  const transaction = await partiallySignTransactionMessageWithSigners(message);
  return {
    sponsorAddress: sponsor.address,
    wireTransaction: getBase64EncodedWireTransaction(transaction),
  };
}

function preparedPayment(
  signer: TransactionSigner,
): PreparedMembershipPaymentTransaction {
  return {
    transaction: {
      messageBytes: new Uint8Array([1, 2, 3]),
      signatures: {
        [sponsorAddress]: signatureBytes,
        [walletAddress]: null,
      },
    } as unknown as Transaction,
    signer,
    sponsorAddress,
    sourceTokenAddress,
    unitsConsumed: null,
    amountBaseUnits: "80000000",
  } as unknown as PreparedMembershipPaymentTransaction;
}

test("membership preparation requests only operation-bound server sponsorship", async () => {
  const sponsored = await sponsoredWireTransaction();
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        status: "ready",
        wireTransaction: sponsored.wireTransaction,
        sponsorAddress: sponsored.sponsorAddress,
        sourceTokenAddress,
        amountBaseUnits: quote.amountBaseUnits,
        unitsConsumed: "467",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  const signer = {
    address: walletAddress,
    async signAndSendTransactions() {
      return [signatureBytes];
    },
  } as TransactionSigner;

  try {
    const prepared = await prepareMembershipPaymentTransaction({
      operationId,
      quote,
      signer,
    });

    assert.deepEqual(requestBody, { operationId });
    assert.equal(prepared.sponsorAddress, sponsored.sponsorAddress);
    assert.equal(prepared.amountBaseUnits, quote.amountBaseUnits);
    assert.ok(prepared.transaction.signatures[sponsored.sponsorAddress]);
    assert.equal(prepared.transaction.signatures[walletAddress], null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("membership preparation preserves precise payment-preflight errors", async () => {
  const signer = {
    address: walletAddress,
    async signAndSendTransactions() {
      return [signatureBytes];
    },
  } as TransactionSigner;
  const originalFetch = globalThis.fetch;

  try {
    for (const code of [
      "rpc-unavailable",
      "source-account-unavailable",
      "source-account-mismatch",
      "destination-account-unavailable",
      "destination-mismatch",
    ] as const) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ status: code }), {
          status: code === "rpc-unavailable" ? 503 : 409,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;

      await assert.rejects(
        prepareMembershipPaymentTransaction({ operationId, quote, signer }),
        (error) =>
          error instanceof MembershipPaymentClientError && error.code === code,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
      const transaction = transactions[0] as Transaction;
      assert.deepEqual(transaction.signatures[sponsorAddress], signatureBytes);
      assert.equal(transaction.signatures[walletAddress], null);
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
