import assert from "node:assert/strict";
import test from "node:test";
import type { MembershipPaymentQuote } from "@/domain/membership-activation";
import {
  isMembershipPaymentDevnetGenesisHash,
  MEMBERSHIP_PAYMENT_DEVNET_GENESIS_HASH,
} from "@/solana/membership-payment";
import { validateMembershipPaymentTransaction } from "@/solana/membership-payment-verification";

const wallet = "So11111111111111111111111111111111111111112";
const source = "ComputeBudget111111111111111111111111111111";
const destination = "BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8";
const poolOwner = "3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL";
const mint = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const reference = "4".repeat(44);
const transactionSignature = "2".repeat(88);

const quote: MembershipPaymentQuote = Object.freeze({
  cluster: "solana:devnet",
  currency: "EURC",
  amountBaseUnits: "80000000",
  walletAddress: wallet,
  destinationOwnerAddress: poolOwner,
  destinationTokenAddress: destination,
  mintAddress: mint,
  tokenProgramAddress: tokenProgram,
  tokenDecimals: 6,
  referenceAddress: reference,
  memo: "movx-membership:v1:98000000-0000-4000-8000-000000000101",
});

function fixture(input?: {
  referenceWritable?: boolean;
  referenceSigner?: boolean;
  destinationOwner?: string;
  transferredAmount?: string;
  executionError?: unknown;
  authorityInfo?: Readonly<Record<string, unknown>>;
}) {
  const transferredAmount = input?.transferredAmount ?? "80000000";
  return {
    version: "legacy",
    slot: BigInt(500_000_001),
    transaction: {
      signatures: [transactionSignature],
      message: {
        accountKeys: [
          { pubkey: wallet, signer: true, writable: true },
          { pubkey: source, signer: false, writable: true },
          { pubkey: mint, signer: false, writable: false },
          { pubkey: destination, signer: false, writable: true },
          {
            pubkey: reference,
            signer: input?.referenceSigner ?? false,
            writable: input?.referenceWritable ?? false,
          },
        ],
        instructions: [
          {
            program: "spl-token",
            programId: tokenProgram,
            parsed: {
              type: "transferChecked",
              info: {
                source,
                mint,
                destination,
                ...(input?.authorityInfo ?? { authority: wallet }),
                tokenAmount: { amount: transferredAmount, decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: {
      err: input?.executionError ?? null,
      preTokenBalances: [
        {
          accountIndex: 1,
          mint,
          owner: wallet,
          programId: tokenProgram,
          uiTokenAmount: { amount: "100000000", decimals: 6 },
        },
        {
          accountIndex: 3,
          mint,
          owner: input?.destinationOwner ?? poolOwner,
          programId: tokenProgram,
          uiTokenAmount: { amount: "50000000", decimals: 6 },
        },
      ],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint,
          owner: wallet,
          programId: tokenProgram,
          uiTokenAmount: { amount: "20000000", decimals: 6 },
        },
        {
          accountIndex: 3,
          mint,
          owner: input?.destinationOwner ?? poolOwner,
          programId: tokenProgram,
          uiTokenAmount: { amount: "130000000", decimals: 6 },
        },
      ],
    },
  };
}

function validate(transaction: unknown) {
  return validateMembershipPaymentTransaction({
    quote,
    signature: transactionSignature,
    expectedSourceTokenAddress: source,
    transaction,
  });
}

test("Devnet cluster verification requires the complete genesis hash", () => {
  assert.equal(
    MEMBERSHIP_PAYMENT_DEVNET_GENESIS_HASH,
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  );
  assert.equal(
    isMembershipPaymentDevnetGenesisHash(
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    ),
    true,
  );
  assert.equal(
    isMembershipPaymentDevnetGenesisHash("EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
    false,
  );
  assert.equal(
    isMembershipPaymentDevnetGenesisHash(
      "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
    ),
    false,
  );
});

test("finalized EURC evidence accepts only the exact quote and balance movement", () => {
  assert.deepEqual(validate(fixture()), {
    status: "verified",
    evidence: {
      signature: transactionSignature,
      slot: "500000001",
      sourceTokenAddress: source,
    },
  });
});

test("payment verification accepts the exact reference-bearing RPC authority shape", () => {
  assert.deepEqual(
    validate(
      fixture({
        authorityInfo: {
          multisigAuthority: wallet,
          signers: [reference],
        },
      }),
    ),
    {
      status: "verified",
      evidence: {
        signature: transactionSignature,
        slot: "500000001",
        sourceTokenAddress: source,
      },
    },
  );
});

test("payment verification rejects ambiguous or genuine multisig evidence", () => {
  const rejected = {
    status: "rejected",
    reason: "transfer-shape-mismatch",
  } as const;

  assert.deepEqual(
    validate(
      fixture({
        authorityInfo: {
          multisigAuthority: poolOwner,
          signers: [reference],
        },
      }),
    ),
    rejected,
  );
  assert.deepEqual(
    validate(
      fixture({
        authorityInfo: {
          multisigAuthority: wallet,
          signers: [reference, poolOwner],
        },
      }),
    ),
    rejected,
  );
  assert.deepEqual(
    validate(
      fixture({
        authorityInfo: {
          authority: wallet,
          multisigAuthority: wallet,
          signers: [reference],
        },
      }),
    ),
    rejected,
  );
  assert.deepEqual(
    validate(
      fixture({
        referenceSigner: true,
        authorityInfo: {
          multisigAuthority: wallet,
          signers: [reference],
        },
      }),
    ),
    { status: "rejected", reason: "reference-mismatch" },
  );
});

test("payment verification rejects mutable references and the wrong pool owner", () => {
  assert.deepEqual(validate(fixture({ referenceWritable: true })), {
    status: "rejected",
    reason: "reference-mismatch",
  });
  assert.deepEqual(validate(fixture({ destinationOwner: wallet })), {
    status: "rejected",
    reason: "balance-mismatch",
  });
});

test("payment verification rejects wrong transfer terms and execution failure", () => {
  assert.deepEqual(validate(fixture({ transferredAmount: "79999999" })), {
    status: "rejected",
    reason: "transfer-shape-mismatch",
  });
  assert.deepEqual(
    validate(fixture({ executionError: { InstructionError: [0, "Custom"] } })),
    {
      status: "rejected",
      reason: "execution-failed",
    },
  );
});
