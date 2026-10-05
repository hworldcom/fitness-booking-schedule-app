import "server-only";

import { address, blockhash, isNone, type Address } from "@solana/kit";
import { OfferStatus } from "../../../clients/js/src/generated/types/offerStatus";
import type {
  CoachPassBootstrapApiResult,
  SubmitCoachPassBootstrapRequest,
} from "@/solana/coach-pass-bootstrap";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveOfferAddress,
  seedToUuid,
} from "@/solana/coach-pass";
import { prepareCoachPassBootstrap } from "@/solana/coach-pass-transaction";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { currentOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import { currentPersonalWalletBinding } from "@/server/db/wallet/repository";
import { coachPassBootstrapConfig } from "./coach-pass-config";
import {
  CoachPassRpcError,
  createCoachPassRpcGateway,
  decodeVerifiedCoachAuthority,
  decodeVerifiedOffer,
  validateCoachPassProgramAccount,
  type CoachPassRpcGateway,
} from "./coach-pass-rpc";
import { validateAndSponsorCoachPassBootstrapTransaction } from "./coach-pass-sponsor";

const APPROVED_BOOTSTRAP = Object.freeze({
  runId: "20000000-0000-4000-8000-000000000001",
  profileId: "bc52d564-3dc0-40fb-8854-dc5dd638bfff",
  coachWalletAddress: address("84g1vMUWb2umWbyEHSkaxpGtqyPDu3RsBnGzRsXfjuCt"),
  oneCreditPriceEurcBaseUnits: BigInt(10_000_000),
  tenCreditPriceEurcBaseUnits: BigInt(100_000_000),
});

type BootstrapContext = Readonly<{
  runId: string;
  profileId: string;
  coachWalletAddress: Address;
}>;

class BootstrapConflictError extends Error {}

async function authorizedBootstrapContext(): Promise<
  | Readonly<{ status: "authorized"; value: BootstrapContext }>
  | Readonly<{
      status: "signed-out" | "preview" | "forbidden" | "unavailable";
    }>
> {
  if (process.env.NODE_ENV === "production") {
    return Object.freeze({ status: "forbidden" });
  }
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const [projection, coach, wallet] = await Promise.all([
      currentActorProjection(transaction, actor),
      currentOwnedCoachProfileRecord(transaction, actor),
      currentPersonalWalletBinding(transaction),
    ]);
    if (
      !projection.coachingActivated ||
      !coach ||
      actor.runId !== APPROVED_BOOTSTRAP.runId ||
      actor.profileId !== APPROVED_BOOTSTRAP.profileId ||
      wallet?.provenance !== "user-proof" ||
      wallet.address !== APPROVED_BOOTSTRAP.coachWalletAddress
    ) {
      throw new BootstrapConflictError();
    }
    return Object.freeze({
      runId: actor.runId,
      profileId: actor.profileId,
      coachWalletAddress: APPROVED_BOOTSTRAP.coachWalletAddress,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", value: result.value });
}

function mapError(error: unknown): CoachPassBootstrapApiResult {
  if (error instanceof BootstrapConflictError) {
    return Object.freeze({ status: "conflict" });
  }
  if (error instanceof CoachPassRpcError) {
    return Object.freeze({
      status: error.code === "rpc-unavailable" ? "unavailable" : "conflict",
    });
  }
  return Object.freeze({ status: "unavailable" });
}

async function readBootstrapAccounts(input: {
  rpc: CoachPassRpcGateway;
  programAddress: Address;
  coachAuthorityAddress: Address;
  oneCreditOfferAddress: Address;
  tenCreditOfferAddress: Address;
  commitment: "confirmed" | "finalized";
  minContextSlot?: bigint;
}) {
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      input.coachAuthorityAddress,
      input.oneCreditOfferAddress,
      input.tenCreditOfferAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  validateCoachPassProgramAccount(read.values[0]!, input.programAddress);
  return Object.freeze({
    slot: read.slot,
    coachAuthority: read.values[1] ?? null,
    oneCreditOffer: read.values[2] ?? null,
    tenCreditOffer: read.values[3] ?? null,
  });
}

function bootstrapStateKind(
  state: Awaited<ReturnType<typeof readBootstrapAccounts>>,
) {
  const accounts = [
    state.coachAuthority,
    state.oneCreditOffer,
    state.tenCreditOffer,
  ];
  if (accounts.every((account) => account === null)) return "absent" as const;
  if (accounts.some((account) => account === null)) {
    throw new BootstrapConflictError();
  }
  return "present" as const;
}

async function assertFinalizedBootstrap(input: {
  state: Awaited<ReturnType<typeof readBootstrapAccounts>>;
  programAddress: Address;
  recoveryAuthority: Address;
}) {
  if (bootstrapStateKind(input.state) !== "present") {
    throw new BootstrapConflictError();
  }
  const coachAuthority = decodeVerifiedCoachAuthority(
    input.state.coachAuthority,
    input.programAddress,
  );
  const oneCreditOffer = decodeVerifiedOffer(
    input.state.oneCreditOffer,
    input.programAddress,
  );
  const tenCreditOffer = decodeVerifiedOffer(
    input.state.tenCreditOffer,
    input.programAddress,
  );
  const [coachAuthorityAddress, authorityBump] =
    await deriveCoachAuthorityAddress({
      programAddress: input.programAddress,
      runId: APPROVED_BOOTSTRAP.runId,
      profileId: APPROVED_BOOTSTRAP.profileId,
      originalWallet: APPROVED_BOOTSTRAP.coachWalletAddress,
    });
  const [, oneCreditBump] = await deriveOfferAddress({
    programAddress: input.programAddress,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(0),
  });
  const [, tenCreditBump] = await deriveOfferAddress({
    programAddress: input.programAddress,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(1),
  });
  if (
    seedToUuid(coachAuthority.runId) !== APPROVED_BOOTSTRAP.runId ||
    seedToUuid(coachAuthority.profileId) !== APPROVED_BOOTSTRAP.profileId ||
    coachAuthority.originalWallet !== APPROVED_BOOTSTRAP.coachWalletAddress ||
    coachAuthority.currentWallet !== APPROVED_BOOTSTRAP.coachWalletAddress ||
    coachAuthority.recoveryAuthority !== input.recoveryAuthority ||
    coachAuthority.authorityEpoch !== BigInt(0) ||
    coachAuthority.eventSequence !== BigInt(2) ||
    coachAuthority.bump !== authorityBump
  ) {
    throw new BootstrapConflictError();
  }
  const offers = [
    {
      value: oneCreditOffer,
      nonce: BigInt(0),
      price: APPROVED_BOOTSTRAP.oneCreditPriceEurcBaseUnits,
      count: 1,
      bump: oneCreditBump,
    },
    {
      value: tenCreditOffer,
      nonce: BigInt(1),
      price: APPROVED_BOOTSTRAP.tenCreditPriceEurcBaseUnits,
      count: 10,
      bump: tenCreditBump,
    },
  ];
  for (const offer of offers) {
    if (
      offer.value.coachAuthority !== coachAuthorityAddress ||
      offer.value.paymentRecipient !== APPROVED_BOOTSTRAP.coachWalletAddress ||
      offer.value.paymentMint !== DEVNET_EURC_MINT_ADDRESS ||
      offer.value.nonce !== offer.nonce ||
      offer.value.priceEurcBaseUnits !== offer.price ||
      offer.value.authorityEpoch !== BigInt(0) ||
      offer.value.validitySeconds !== 0 ||
      offer.value.sessionCount !== offer.count ||
      offer.value.status !== OfferStatus.Active ||
      offer.value.bump !== offer.bump ||
      !isNone(offer.value.restrictedClient) ||
      !isNone(offer.value.deactivatedAt)
    ) {
      throw new BootstrapConflictError();
    }
  }
}

async function buildPreparation(input: {
  context: BootstrapContext;
  recentBlockhash: string;
  lastValidBlockHeight: bigint;
}) {
  const config = await coachPassBootstrapConfig();
  return Object.freeze({
    config,
    prepared: await prepareCoachPassBootstrap({
      programAddress: config.programAddress,
      platformPayerAddress: config.sponsor.address,
      lifetimeConstraint: {
        blockhash: blockhash(input.recentBlockhash),
        lastValidBlockHeight: input.lastValidBlockHeight,
      },
      runId: input.context.runId,
      profileId: input.context.profileId,
      coachWalletAddress: input.context.coachWalletAddress,
      recoveryAuthorityAddress: config.recoveryAuthority,
      oneCreditPriceEurcBaseUnits:
        APPROVED_BOOTSTRAP.oneCreditPriceEurcBaseUnits,
      tenCreditPriceEurcBaseUnits:
        APPROVED_BOOTSTRAP.tenCreditPriceEurcBaseUnits,
    }),
  });
}

export async function prepareApprovedCoachPassBootstrap(): Promise<CoachPassBootstrapApiResult> {
  try {
    const context = await authorizedBootstrapContext();
    if (context.status !== "authorized") return context;
    const config = await coachPassBootstrapConfig();
    const rpc = createCoachPassRpcGateway(config.serverRpcUrl);
    const initial = await prepareCoachPassBootstrap({
      programAddress: config.programAddress,
      platformPayerAddress: config.sponsor.address,
      lifetimeConstraint: await rpc.latestBlockhash(),
      runId: context.value.runId,
      profileId: context.value.profileId,
      coachWalletAddress: context.value.coachWalletAddress,
      recoveryAuthorityAddress: config.recoveryAuthority,
      oneCreditPriceEurcBaseUnits:
        APPROVED_BOOTSTRAP.oneCreditPriceEurcBaseUnits,
      tenCreditPriceEurcBaseUnits:
        APPROVED_BOOTSTRAP.tenCreditPriceEurcBaseUnits,
    });
    const accounts = await readBootstrapAccounts({
      rpc,
      programAddress: config.programAddress,
      coachAuthorityAddress: initial.summary.coachAuthorityAddress,
      oneCreditOfferAddress: initial.summary.oneCreditOfferAddress,
      tenCreditOfferAddress: initial.summary.tenCreditOfferAddress,
      commitment: "finalized",
    });
    if (bootstrapStateKind(accounts) !== "absent") {
      throw new BootstrapConflictError();
    }
    const lifetime = await rpc.latestBlockhash(accounts.slot);
    const { prepared } = await buildPreparation({
      context: context.value,
      recentBlockhash: lifetime.blockhash,
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
    });
    const simulation = await rpc.simulate(
      prepared.transactionBase64,
      accounts.slot,
    );
    return Object.freeze({
      status: "prepared",
      prepared,
      simulation: Object.freeze({
        slot: simulation.slot.toString(),
        unitsConsumed: simulation.unitsConsumed?.toString() ?? null,
      }),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function submitApprovedCoachPassBootstrap(
  request: SubmitCoachPassBootstrapRequest,
): Promise<CoachPassBootstrapApiResult> {
  try {
    const context = await authorizedBootstrapContext();
    if (context.status !== "authorized") return context;
    const { config, prepared } = await buildPreparation({
      context: context.value,
      recentBlockhash: request.prepared.recentBlockhash,
      lastValidBlockHeight: BigInt(request.prepared.lastValidBlockHeight),
    });
    if (
      prepared.transactionBase64 !== request.prepared.transactionBase64 ||
      prepared.messageBase64 !== request.prepared.messageBase64 ||
      JSON.stringify(prepared.summary) !==
        JSON.stringify(request.prepared.summary)
    ) {
      throw new BootstrapConflictError();
    }
    const sponsored = await validateAndSponsorCoachPassBootstrapTransaction({
      prepared,
      walletSignedTransactionBase64: request.walletSignedTransactionBase64,
      sponsor: config.sponsor,
    });
    const rpc = createCoachPassRpcGateway(config.serverRpcUrl);
    const status = await rpc.signatureStatus(sponsored.transactionSignature);
    if (status !== null && status.error !== null) {
      return Object.freeze({
        status: "failed",
        transactionSignature: sponsored.transactionSignature,
        finalizedSlot: status.slot.toString(),
      });
    }
    if (status?.confirmationStatus === "finalized") {
      const finalized = await readBootstrapAccounts({
        rpc,
        programAddress: config.programAddress,
        coachAuthorityAddress: prepared.summary.coachAuthorityAddress,
        oneCreditOfferAddress: prepared.summary.oneCreditOfferAddress,
        tenCreditOfferAddress: prepared.summary.tenCreditOfferAddress,
        commitment: "finalized",
        minContextSlot: status.slot,
      });
      await assertFinalizedBootstrap({
        state: finalized,
        programAddress: config.programAddress,
        recoveryAuthority: config.recoveryAuthority,
      });
      return Object.freeze({
        status: "finalized",
        transactionSignature: sponsored.transactionSignature,
        finalizedSlot: status.slot.toString(),
      });
    }
    if (status !== null) {
      return Object.freeze({
        status: "submitted",
        transactionSignature: sponsored.transactionSignature,
        finalizedSlot: null,
      });
    }
    const state = await readBootstrapAccounts({
      rpc,
      programAddress: config.programAddress,
      coachAuthorityAddress: prepared.summary.coachAuthorityAddress,
      oneCreditOfferAddress: prepared.summary.oneCreditOfferAddress,
      tenCreditOfferAddress: prepared.summary.tenCreditOfferAddress,
      commitment: "finalized",
    });
    if (bootstrapStateKind(state) === "present") {
      await assertFinalizedBootstrap({
        state,
        programAddress: config.programAddress,
        recoveryAuthority: config.recoveryAuthority,
      });
      return Object.freeze({
        status: "finalized",
        transactionSignature: sponsored.transactionSignature,
        finalizedSlot: state.slot.toString(),
      });
    }
    if (
      (await rpc.blockHeight("confirmed")) >
      BigInt(prepared.lastValidBlockHeight)
    ) {
      return Object.freeze({
        status: "expired",
        transactionSignature: sponsored.transactionSignature,
        finalizedSlot: null,
      });
    }
    const returnedSignature = await rpc.send(sponsored.transactionBase64);
    if (returnedSignature !== sponsored.transactionSignature) {
      throw new BootstrapConflictError();
    }
    return Object.freeze({
      status: "submitted",
      transactionSignature: sponsored.transactionSignature,
      finalizedSlot: null,
    });
  } catch (error) {
    return mapError(error);
  }
}
