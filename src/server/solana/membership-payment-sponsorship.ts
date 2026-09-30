import "server-only";

import { getAddMemoInstruction } from "@solana-program/memo";
import {
  fetchAllMaybeToken,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  devnet,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type AccountMeta,
  type Instruction,
} from "@solana/kit";
import { checkMembershipPaymentTokenAccounts } from "@/solana/membership-payment-accounts";
import type { MembershipPaymentQuote } from "@/solana/membership-payment";
import { rpcFailureDiagnostic } from "@/solana/rpc-failure-diagnostic";
import { membershipFeeSponsorConfig } from "./membership-fee-sponsor-config";
import {
  membershipPaymentConfig,
  type MembershipPaymentConfig,
} from "./membership-payment-config";

export type MembershipPaymentSponsorshipResult =
  | Readonly<{
      status: "ready";
      wireTransaction: string;
      sponsorAddress: string;
      sourceTokenAddress: string;
      amountBaseUnits: string;
      unitsConsumed: string | null;
    }>
  | Readonly<{
      status:
        | "configuration-unavailable"
        | "rpc-unavailable"
        | "source-account-unavailable"
        | "source-account-mismatch"
        | "destination-account-unavailable"
        | "insufficient-eurc"
        | "destination-mismatch"
        | "simulation-failed";
    }>;

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

export async function sponsorMembershipPayment(
  quote: MembershipPaymentQuote,
): Promise<MembershipPaymentSponsorshipResult> {
  const [paymentConfig, sponsor] = await Promise.all([
    Promise.resolve(membershipPaymentConfig()),
    membershipFeeSponsorConfig(),
  ]);
  if (!paymentConfig || !sponsor || !quoteMatchesConfig(quote, paymentConfig)) {
    return Object.freeze({ status: "configuration-unavailable" });
  }

  const rpc = createSolanaRpc(devnet(paymentConfig.serverRpcUrl));
  const memberAuthority = createNoopSigner(address(quote.walletAddress));
  const mintAddress = address(quote.mintAddress);
  const tokenProgramAddress = address(quote.tokenProgramAddress);
  const [sourceTokenAddress] = await findAssociatedTokenPda({
    owner: memberAuthority.address,
    mint: mintAddress,
    tokenProgram: tokenProgramAddress,
  });
  const [destinationTokenAddress] = await findAssociatedTokenPda({
    owner: address(quote.destinationOwnerAddress),
    mint: mintAddress,
    tokenProgram: tokenProgramAddress,
  });
  if (destinationTokenAddress !== quote.destinationTokenAddress) {
    return Object.freeze({ status: "destination-mismatch" });
  }

  const accountCheck = await checkMembershipPaymentTokenAccounts({
    sourceAddress: sourceTokenAddress,
    sourceOwnerAddress: memberAuthority.address,
    destinationAddress: destinationTokenAddress,
    destinationOwnerAddress: address(quote.destinationOwnerAddress),
    mintAddress,
    tokenProgramAddress,
    requiredAmount: BigInt(quote.amountBaseUnits),
    fetchAccounts: async (addresses) => {
      try {
        return await fetchAllMaybeToken(rpc, [...addresses], {
          abortSignal: AbortSignal.timeout(12_000),
          commitment: "confirmed",
        });
      } catch (error) {
        console.warn(
          "membership-payment-account-rpc-failure",
          rpcFailureDiagnostic(error),
        );
        throw error;
      }
    },
  });
  if (accountCheck.status !== "ready") {
    return accountCheck;
  }

  try {
    const transferInstruction = withReferenceAccount(
      getTransferCheckedInstruction(
        {
          source: sourceTokenAddress,
          mint: mintAddress,
          destination: destinationTokenAddress,
          authority: memberAuthority,
          amount: BigInt(quote.amountBaseUnits),
          decimals: quote.tokenDecimals,
        },
        { programAddress: tokenProgramAddress },
      ),
      quote.referenceAddress,
    );
    const { value: latestBlockhash } = await rpc
      .getLatestBlockhash({ commitment: "confirmed" })
      .send({ abortSignal: AbortSignal.timeout(12_000) });
    const transactionMessage = appendTransactionMessageInstructions(
      [transferInstruction, getAddMemoInstruction({ memo: quote.memo })],
      setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        setTransactionMessageFeePayerSigner(
          sponsor.signer,
          createTransactionMessage({ version: "legacy" }),
        ),
      ),
    );
    const sponsoredTransaction =
      await partiallySignTransactionMessageWithSigners(transactionMessage);
    const wireTransaction =
      getBase64EncodedWireTransaction(sponsoredTransaction);
    const simulation = await rpc
      .simulateTransaction(wireTransaction, {
        commitment: "confirmed",
        encoding: "base64",
        sigVerify: false,
      })
      .send({ abortSignal: AbortSignal.timeout(12_000) });
    if (simulation.value.err !== null) {
      return Object.freeze({ status: "simulation-failed" });
    }
    return Object.freeze({
      status: "ready",
      wireTransaction,
      sponsorAddress: sponsor.address,
      sourceTokenAddress,
      amountBaseUnits: quote.amountBaseUnits,
      unitsConsumed: simulation.value.unitsConsumed?.toString() ?? null,
    });
  } catch {
    return Object.freeze({ status: "simulation-failed" });
  }
}
