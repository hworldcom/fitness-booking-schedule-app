"use client";

import { getBase64Decoder, getBase64Encoder } from "@solana/kit";
import {
  isCoachPassOperationApiResult,
  type CoachPassOperationApiResult,
  type PrepareCoachPassOperationRequest,
  type PreparedCoachPassOperationResult,
  type SubmitCoachPassOperationRequest,
} from "@/solana/coach-pass-operation";

type Fetcher = typeof fetch;

export type CoachPassWalletSignTransaction = (
  input: Readonly<{
    transaction: Uint8Array;
    options?: Readonly<{ minContextSlot?: bigint }>;
  }>,
) => Promise<Readonly<{ signedTransaction: Uint8Array }>>;

async function postCoachPassOperation(
  path: "prepare" | "submit" | "recover" | "reject",
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<CoachPassOperationApiResult> {
  const response = await fetcher(`/api/solana/coach-pass/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Coach-pass service returned an unreadable response.");
  }
  if (!isCoachPassOperationApiResult(result)) {
    throw new Error("Coach-pass service returned an invalid response.");
  }
  return result;
}

export function prepareCoachPassOperationRequest(
  request: PrepareCoachPassOperationRequest,
  fetcher?: Fetcher,
) {
  return postCoachPassOperation("prepare", request, fetcher);
}

export function submitCoachPassOperationRequest(
  request: SubmitCoachPassOperationRequest,
  fetcher?: Fetcher,
) {
  return postCoachPassOperation("submit", request, fetcher);
}

export function recoverCoachPassOperationRequest(
  operationId: string,
  fetcher?: Fetcher,
) {
  return postCoachPassOperation("recover", { operationId }, fetcher);
}

export function rejectCoachPassOperationRequest(
  operationId: string,
  fetcher?: Fetcher,
) {
  return postCoachPassOperation("reject", { operationId }, fetcher);
}

export async function signPreparedCoachPassOperation(
  result: PreparedCoachPassOperationResult,
  signTransaction: CoachPassWalletSignTransaction,
) {
  const transaction = new Uint8Array(
    getBase64Encoder().encode(result.prepared.transactionBase64),
  );
  const signed = await signTransaction({
    transaction,
    options: { minContextSlot: BigInt(result.simulation.slot) },
  });
  if (!(signed.signedTransaction instanceof Uint8Array)) {
    throw new Error("Wallet returned an invalid signed transaction.");
  }
  return getBase64Decoder().decode(signed.signedTransaction);
}

export async function approveCoachPassOperation(
  result: PreparedCoachPassOperationResult,
  signTransaction: CoachPassWalletSignTransaction,
  fetcher?: Fetcher,
) {
  const walletSignedTransactionBase64 = await signPreparedCoachPassOperation(
    result,
    signTransaction,
  );
  return submitCoachPassOperationRequest(
    { operationId: result.operationId, walletSignedTransactionBase64 },
    fetcher,
  );
}
