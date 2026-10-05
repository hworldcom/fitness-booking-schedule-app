"use client";

import { getBase64Decoder, getBase64Encoder } from "@solana/kit";
import {
  isCoachPassBootstrapApiResult,
  type CoachPassBootstrapApiResult,
  type PreparedCoachPassBootstrapResult,
  type SubmitCoachPassBootstrapRequest,
} from "@/solana/coach-pass-bootstrap";
import type { CoachPassWalletSignTransaction } from "./coach-pass-client";

type Fetcher = typeof fetch;

async function postBootstrap(
  path: "prepare" | "submit",
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<CoachPassBootstrapApiResult> {
  const response = await fetcher(`/api/solana/coach-pass/bootstrap/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const value: unknown = await response.json().catch(() => null);
  if (!isCoachPassBootstrapApiResult(value)) {
    throw new Error("Bootstrap service returned an invalid response.");
  }
  return value;
}

export function prepareCoachPassBootstrapRequest(fetcher?: Fetcher) {
  return postBootstrap("prepare", {}, fetcher);
}

export function submitCoachPassBootstrapRequest(
  request: SubmitCoachPassBootstrapRequest,
  fetcher?: Fetcher,
) {
  return postBootstrap("submit", request, fetcher);
}

export async function signCoachPassBootstrapTransaction(
  transactionBase64: string,
  simulationSlot: string,
  signTransaction: CoachPassWalletSignTransaction,
) {
  const signed = await signTransaction({
    transaction: new Uint8Array(getBase64Encoder().encode(transactionBase64)),
    options: { minContextSlot: BigInt(simulationSlot) },
  });
  if (!(signed.signedTransaction instanceof Uint8Array)) {
    throw new Error("Wallet returned an invalid signed transaction.");
  }
  return getBase64Decoder().decode(signed.signedTransaction);
}

export async function submitSignedCoachPassBootstrap(
  prepared: PreparedCoachPassBootstrapResult,
  walletSignedTransactionBase64: string,
  fetcher?: Fetcher,
) {
  return submitCoachPassBootstrapRequest(
    { prepared: prepared.prepared, walletSignedTransactionBase64 },
    fetcher,
  );
}
