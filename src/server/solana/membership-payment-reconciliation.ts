import "server-only";

import { findAssociatedTokenPda } from "@solana-program/token";
import { address, createSolanaRpc, devnet, signature } from "@solana/kit";
import type { MembershipPaymentQuote } from "@/solana/membership-payment";
import { isMembershipPaymentDevnetGenesisHash } from "@/solana/membership-payment";
import {
  validateMembershipPaymentTransaction,
  type VerifiedMembershipPaymentEvidence,
} from "@/solana/membership-payment-verification";
import {
  membershipPaymentConfig,
  type MembershipPaymentConfig,
} from "./membership-payment-config";

const MAX_REFERENCE_CANDIDATES = 8;

export type MembershipPaymentReconciliation =
  | Readonly<{
      status: "verified";
      evidence: VerifiedMembershipPaymentEvidence;
    }>
  | Readonly<{
      status: "pending";
      reason: "not-found" | "not-finalized" | "rpc-unavailable";
    }>
  | Readonly<{
      status: "rejected";
      reason: string;
    }>
  | Readonly<{ status: "configuration-unavailable" }>;

function quoteMatchesConfig(
  quote: MembershipPaymentQuote,
  config: MembershipPaymentConfig,
) {
  return (
    quote.cluster === config.cluster &&
    quote.mintAddress === config.mintAddress &&
    quote.tokenProgramAddress === config.tokenProgramAddress &&
    quote.tokenDecimals === config.tokenDecimals &&
    quote.destinationOwnerAddress === config.poolOwnerAddress &&
    quote.destinationTokenAddress === config.poolTokenAddress
  );
}

async function verifySignature(
  config: MembershipPaymentConfig,
  quote: MembershipPaymentQuote,
  transactionSignature: string,
): Promise<MembershipPaymentReconciliation> {
  const rpc = createSolanaRpc(devnet(config.serverRpcUrl));
  const abortSignal = AbortSignal.timeout(12_000);
  try {
    const genesisHash = await rpc.getGenesisHash().send({ abortSignal });
    if (!isMembershipPaymentDevnetGenesisHash(genesisHash)) {
      return { status: "rejected", reason: "wrong-cluster" };
    }
    const typedSignature = signature(transactionSignature);
    const statusResponse = await rpc
      .getSignatureStatuses([typedSignature], {
        searchTransactionHistory: true,
      })
      .send({ abortSignal });
    const transactionStatus = statusResponse.value[0];
    if (!transactionStatus) {
      return { status: "pending", reason: "not-found" };
    }
    if (transactionStatus.err !== null) {
      return { status: "rejected", reason: "execution-failed" };
    }
    if (transactionStatus.confirmationStatus !== "finalized") {
      return { status: "pending", reason: "not-finalized" };
    }
    const transaction = await rpc
      .getTransaction(typedSignature, {
        commitment: "finalized",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      })
      .send({ abortSignal });
    if (!transaction) {
      return { status: "pending", reason: "not-found" };
    }
    const [expectedSourceTokenAddress] = await findAssociatedTokenPda({
      owner: address(quote.walletAddress),
      mint: address(quote.mintAddress),
      tokenProgram: address(quote.tokenProgramAddress),
    });
    return validateMembershipPaymentTransaction({
      quote,
      signature: transactionSignature,
      expectedSourceTokenAddress,
      transaction,
    });
  } catch {
    return { status: "pending", reason: "rpc-unavailable" };
  }
}

export async function reconcileMembershipPayment(input: {
  quote: MembershipPaymentQuote;
  transactionSignature: string | null;
}): Promise<MembershipPaymentReconciliation> {
  const config = membershipPaymentConfig();
  if (!config || !quoteMatchesConfig(input.quote, config)) {
    return { status: "configuration-unavailable" };
  }
  if (input.transactionSignature) {
    return verifySignature(config, input.quote, input.transactionSignature);
  }

  const rpc = createSolanaRpc(devnet(config.serverRpcUrl));
  try {
    const candidates = await rpc
      .getSignaturesForAddress(address(input.quote.referenceAddress), {
        commitment: "finalized",
        limit: MAX_REFERENCE_CANDIDATES,
      })
      .send({ abortSignal: AbortSignal.timeout(12_000) });
    for (const candidate of candidates) {
      if (
        candidate.err !== null ||
        candidate.confirmationStatus !== "finalized"
      ) {
        continue;
      }
      const result = await verifySignature(
        config,
        input.quote,
        candidate.signature,
      );
      if (result.status === "verified") return result;
    }
    return { status: "pending", reason: "not-found" };
  } catch {
    return { status: "pending", reason: "rpc-unavailable" };
  }
}
