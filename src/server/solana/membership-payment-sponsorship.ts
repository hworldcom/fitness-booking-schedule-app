import "server-only";

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
import type { MembershipPaymentQuote } from "@/solana/membership-payment";
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
        | "account-unavailable"
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

  let sourceAccount;
  let destinationAccount;
  try {
    [sourceAccount, destinationAccount] = await Promise.all([
      fetchToken(rpc, sourceTokenAddress, { commitment: "confirmed" }),
      fetchToken(rpc, destinationTokenAddress, { commitment: "confirmed" }),
    ]);
  } catch {
    return Object.freeze({ status: "account-unavailable" });
  }
  if (
    sourceAccount.data.owner !== memberAuthority.address ||
    sourceAccount.data.mint !== mintAddress ||
    destinationAccount.data.owner !== quote.destinationOwnerAddress ||
    destinationAccount.data.mint !== mintAddress
  ) {
    return Object.freeze({ status: "destination-mismatch" });
  }
  if (sourceAccount.data.amount < BigInt(quote.amountBaseUnits)) {
    return Object.freeze({ status: "insufficient-eurc" });
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
