"use client";

import {
  address,
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
  isTransactionSendingSigner,
  signAndSendTransactionWithSigners,
  type Address,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";
import { sponsorMembershipActivationRequest } from "@/features/membership/activation-client";
import type { MembershipPaymentQuote } from "@/solana/membership-payment";

export type MembershipPaymentClientErrorCode =
  | "configuration-unavailable"
  | "wallet-mismatch"
  | "unsupported-wallet"
  | "source-account-unavailable"
  | "insufficient-eurc"
  | "destination-mismatch"
  | "simulation-failed"
  | "sponsor-unavailable"
  | "wallet-cancelled"
  | "broadcast-failed";

export class MembershipPaymentClientError extends Error {
  constructor(readonly code: MembershipPaymentClientErrorCode) {
    super(code);
    this.name = "MembershipPaymentClientError";
  }
}

function walletCancelled(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 4001 || code === "4001";
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sponsorshipError(status: unknown) {
  switch (status) {
    case "configuration-unavailable":
      return new MembershipPaymentClientError("configuration-unavailable");
    case "account-unavailable":
      return new MembershipPaymentClientError("source-account-unavailable");
    case "insufficient-eurc":
      return new MembershipPaymentClientError("insufficient-eurc");
    case "destination-mismatch":
      return new MembershipPaymentClientError("destination-mismatch");
    case "simulation-failed":
      return new MembershipPaymentClientError("simulation-failed");
    default:
      return new MembershipPaymentClientError("sponsor-unavailable");
  }
}

function decodeSponsoredTransaction(input: {
  wireTransaction: string;
  sponsorAddress: Address;
  walletAddress: Address;
}): Transaction {
  if (
    input.wireTransaction.length === 0 ||
    input.wireTransaction.length > 2_048
  ) {
    throw new MembershipPaymentClientError("sponsor-unavailable");
  }
  try {
    const transaction = getTransactionDecoder().decode(
      getBase64Encoder().encode(input.wireTransaction) as Uint8Array,
    );
    const signatures = transaction.signatures;
    const signerAddresses = Object.keys(signatures);
    if (
      signerAddresses.length !== 2 ||
      signerAddresses[0] !== input.sponsorAddress ||
      signerAddresses[1] !== input.walletAddress ||
      !signatures[input.sponsorAddress] ||
      signatures[input.walletAddress] !== null
    ) {
      throw new Error("Unexpected sponsored transaction signers.");
    }
    return transaction;
  } catch (error) {
    if (error instanceof MembershipPaymentClientError) throw error;
    throw new MembershipPaymentClientError("sponsor-unavailable");
  }
}

export async function prepareMembershipPaymentTransaction(input: {
  operationId: string;
  quote: MembershipPaymentQuote;
  signer: TransactionSigner;
}) {
  if (input.signer.address !== input.quote.walletAddress) {
    throw new MembershipPaymentClientError("wallet-mismatch");
  }
  if (!isTransactionSendingSigner(input.signer)) {
    throw new MembershipPaymentClientError("unsupported-wallet");
  }
  const result = object(
    await sponsorMembershipActivationRequest(input.operationId),
  );
  if (result?.status !== "ready") {
    throw sponsorshipError(result?.status);
  }
  if (
    typeof result.wireTransaction !== "string" ||
    typeof result.sponsorAddress !== "string" ||
    typeof result.sourceTokenAddress !== "string" ||
    result.amountBaseUnits !== input.quote.amountBaseUnits ||
    (result.unitsConsumed !== null && typeof result.unitsConsumed !== "string")
  ) {
    throw new MembershipPaymentClientError("sponsor-unavailable");
  }
  let sponsorAddress: Address;
  let sourceTokenAddress: Address;
  try {
    sponsorAddress = address(result.sponsorAddress);
    sourceTokenAddress = address(result.sourceTokenAddress);
  } catch {
    throw new MembershipPaymentClientError("sponsor-unavailable");
  }
  if (sponsorAddress === input.signer.address) {
    throw new MembershipPaymentClientError("sponsor-unavailable");
  }
  return Object.freeze({
    transaction: decodeSponsoredTransaction({
      wireTransaction: result.wireTransaction,
      sponsorAddress,
      walletAddress: input.signer.address,
    }),
    signer: input.signer,
    sponsorAddress,
    sourceTokenAddress,
    unitsConsumed: result.unitsConsumed,
    amountBaseUnits: input.quote.amountBaseUnits,
  });
}

export type PreparedMembershipPaymentTransaction = Awaited<
  ReturnType<typeof prepareMembershipPaymentTransaction>
>;

export async function approveAndBroadcastMembershipPayment(input: {
  prepared: PreparedMembershipPaymentTransaction;
}) {
  let transactionSignatureBytes;
  try {
    transactionSignatureBytes = await signAndSendTransactionWithSigners(
      [input.prepared.signer],
      input.prepared.transaction,
    );
  } catch (error) {
    if (walletCancelled(error)) {
      throw new MembershipPaymentClientError("wallet-cancelled");
    }
    throw new MembershipPaymentClientError("broadcast-failed");
  }
  return Object.freeze({
    signature: getBase58Decoder().decode(transactionSignatureBytes),
  });
}
