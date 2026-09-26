"use client";

import { getAddMemoInstruction } from "@solana-program/memo";
import {
  fetchToken,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  devnet,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type AccountMeta,
  type TransactionSigner,
} from "@solana/kit";
import type { MembershipPaymentQuote } from "@/solana/membership-payment";

export type MembershipPaymentClientErrorCode =
  | "configuration-unavailable"
  | "wallet-mismatch"
  | "unsupported-wallet"
  | "source-account-unavailable"
  | "insufficient-eurc"
  | "destination-mismatch"
  | "simulation-failed"
  | "wallet-cancelled"
  | "broadcast-failed";

export class MembershipPaymentClientError extends Error {
  constructor(readonly code: MembershipPaymentClientErrorCode) {
    super(code);
    this.name = "MembershipPaymentClientError";
  }
}

function browserRpcUrl() {
  const value = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      )
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function withReferenceAccount<
  TInstruction extends Instruction & {
    readonly accounts: readonly AccountMeta[];
  },
>(instruction: TInstruction, referenceAddress: string): Instruction {
  return Object.freeze({
    ...instruction,
    accounts: Object.freeze([
      ...instruction.accounts,
      Object.freeze({
        address: address(referenceAddress),
        role: AccountRole.READONLY,
      }),
    ]),
  });
}

function walletCancelled(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 4001 || code === "4001";
}

export async function prepareMembershipPaymentTransaction(input: {
  quote: MembershipPaymentQuote;
  signer: TransactionSigner;
}) {
  const rpcUrl = browserRpcUrl();
  if (!rpcUrl) {
    throw new MembershipPaymentClientError("configuration-unavailable");
  }
  if (input.signer.address !== input.quote.walletAddress) {
    throw new MembershipPaymentClientError("wallet-mismatch");
  }
  const rpc = createSolanaRpc(devnet(rpcUrl));
  const mintAddress = address(input.quote.mintAddress);
  const tokenProgramAddress = address(input.quote.tokenProgramAddress);
  const [sourceTokenAddress] = await findAssociatedTokenPda({
    owner: input.signer.address,
    mint: mintAddress,
    tokenProgram: tokenProgramAddress,
  });
  const [destinationTokenAddress] = await findAssociatedTokenPda({
    owner: address(input.quote.destinationOwnerAddress),
    mint: mintAddress,
    tokenProgram: tokenProgramAddress,
  });
  if (destinationTokenAddress !== input.quote.destinationTokenAddress) {
    throw new MembershipPaymentClientError("destination-mismatch");
  }

  let sourceAccount;
  let destinationAccount;
  try {
    [sourceAccount, destinationAccount] = await Promise.all([
      fetchToken(rpc, sourceTokenAddress, { commitment: "confirmed" }),
      fetchToken(rpc, destinationTokenAddress, { commitment: "confirmed" }),
    ]);
  } catch {
    throw new MembershipPaymentClientError("source-account-unavailable");
  }
  if (
    sourceAccount.data.owner !== input.signer.address ||
    sourceAccount.data.mint !== mintAddress ||
    destinationAccount.data.owner !== input.quote.destinationOwnerAddress ||
    destinationAccount.data.mint !== mintAddress
  ) {
    throw new MembershipPaymentClientError("destination-mismatch");
  }
  if (sourceAccount.data.amount < BigInt(input.quote.amountBaseUnits)) {
    throw new MembershipPaymentClientError("insufficient-eurc");
  }

  const transferInstruction = withReferenceAccount(
    getTransferCheckedInstruction(
      {
        source: sourceTokenAddress,
        mint: mintAddress,
        destination: destinationTokenAddress,
        authority: input.signer,
        amount: BigInt(input.quote.amountBaseUnits),
        decimals: input.quote.tokenDecimals,
      },
      { programAddress: tokenProgramAddress },
    ),
    input.quote.referenceAddress,
  );
  const memoInstruction = getAddMemoInstruction({ memo: input.quote.memo });
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send({ abortSignal: AbortSignal.timeout(12_000) });
  const transactionMessage = appendTransactionMessageInstructions(
    [transferInstruction, memoInstruction],
    setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      setTransactionMessageFeePayerSigner(
        input.signer,
        createTransactionMessage({ version: "legacy" }),
      ),
    ),
  );
  const compiledTransaction = compileTransaction(transactionMessage);
  try {
    const simulation = await rpc
      .simulateTransaction(
        getBase64EncodedWireTransaction(compiledTransaction),
        {
          commitment: "confirmed",
          encoding: "base64",
          sigVerify: false,
        },
      )
      .send({ abortSignal: AbortSignal.timeout(12_000) });
    if (simulation.value.err !== null) {
      throw new MembershipPaymentClientError("simulation-failed");
    }
    return Object.freeze({
      transactionMessage,
      sourceTokenAddress,
      unitsConsumed: simulation.value.unitsConsumed?.toString() ?? null,
    });
  } catch (error) {
    if (error instanceof MembershipPaymentClientError) throw error;
    throw new MembershipPaymentClientError("simulation-failed");
  }
}

export type PreparedMembershipPaymentTransaction = Awaited<
  ReturnType<typeof prepareMembershipPaymentTransaction>
>;

export async function approveAndBroadcastMembershipPayment(input: {
  prepared: PreparedMembershipPaymentTransaction;
}) {
  const rpcUrl = browserRpcUrl();
  if (!rpcUrl) {
    throw new MembershipPaymentClientError("configuration-unavailable");
  }
  let signedTransaction;
  try {
    signedTransaction = await signTransactionMessageWithSigners(
      input.prepared.transactionMessage,
    );
  } catch (error) {
    if (walletCancelled(error)) {
      throw new MembershipPaymentClientError("wallet-cancelled");
    }
    throw new MembershipPaymentClientError("unsupported-wallet");
  }
  const transactionSignature = getSignatureFromTransaction(signedTransaction);
  const rpc = createSolanaRpc(devnet(rpcUrl));
  try {
    const acknowledgedSignature = await rpc
      .sendTransaction(getBase64EncodedWireTransaction(signedTransaction), {
        encoding: "base64",
        maxRetries: BigInt(3),
        preflightCommitment: "confirmed",
        skipPreflight: false,
      })
      .send({ abortSignal: AbortSignal.timeout(20_000) });
    if (acknowledgedSignature !== transactionSignature) {
      throw new MembershipPaymentClientError("broadcast-failed");
    }
    return Object.freeze({
      signature: transactionSignature,
      broadcastAcknowledged: true,
    });
  } catch {
    return Object.freeze({
      signature: transactionSignature,
      broadcastAcknowledged: false,
    });
  }
}
