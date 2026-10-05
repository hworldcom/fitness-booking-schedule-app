"use client";

import { getBase64Decoder, getBase64Encoder } from "@solana/kit";
import {
  isGroupEventOperationApiResult,
  type GroupEventOperationApiResult,
  type PrepareGroupEventOperationRequest,
  type PreparedGroupEventOperationResult,
  type SubmitGroupEventOperationRequest,
} from "@/solana/group-event-operation";

type Fetcher = typeof fetch;

export type GroupEventWalletSignTransaction = (
  input: Readonly<{
    transaction: Uint8Array;
    options?: Readonly<{ minContextSlot?: bigint }>;
  }>,
) => Promise<Readonly<{ signedTransaction: Uint8Array }>>;

async function postGroupEventOperation(
  path: "prepare" | "submit" | "recover" | "reject",
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<GroupEventOperationApiResult> {
  const response = await fetcher(`/api/solana/group-events/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Group-event service returned an unreadable response.");
  }
  if (!isGroupEventOperationApiResult(result)) {
    throw new Error("Group-event service returned an invalid response.");
  }
  return result;
}

export function prepareGroupEventOperationRequest(
  request: PrepareGroupEventOperationRequest,
  fetcher?: Fetcher,
) {
  return postGroupEventOperation("prepare", request, fetcher);
}

export function submitGroupEventOperationRequest(
  request: SubmitGroupEventOperationRequest,
  fetcher?: Fetcher,
) {
  return postGroupEventOperation("submit", request, fetcher);
}

export function recoverGroupEventOperationRequest(
  operationId: string,
  fetcher?: Fetcher,
) {
  return postGroupEventOperation("recover", { operationId }, fetcher);
}

export function rejectGroupEventOperationRequest(
  operationId: string,
  fetcher?: Fetcher,
) {
  return postGroupEventOperation("reject", { operationId }, fetcher);
}

export async function signPreparedGroupEventOperation(
  result: PreparedGroupEventOperationResult,
  signTransaction: GroupEventWalletSignTransaction,
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

export async function approveGroupEventOperation(
  result: PreparedGroupEventOperationResult,
  signTransaction: GroupEventWalletSignTransaction,
  fetcher?: Fetcher,
) {
  const walletSignedTransactionBase64 = await signPreparedGroupEventOperation(
    result,
    signTransaction,
  );
  return submitGroupEventOperationRequest(
    { operationId: result.operationId, walletSignedTransactionBase64 },
    fetcher,
  );
}
