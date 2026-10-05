import "server-only";

import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { address } from "@solana/kit";
import { ContributionStatus } from "../../../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../../../clients/js/src/generated/types/eventPoolStatus";
import type {
  VerifiedGroupEventContributionProjection,
  VerifiedGroupEventPoolProjection,
} from "@/domain/group-events";
import { seedToUuid, DEVNET_EURC_MINT_ADDRESS } from "@/solana/coach-pass";
import {
  type GroupEventOperationApiResult,
  type GroupEventOperationSnapshot,
  type PrepareGroupEventOperationRequest,
  type PreparedGroupEventOperationResult,
  type SubmitGroupEventOperationRequest,
} from "@/solana/group-event-operation";
import {
  deriveEventPoolAddress,
  deriveEventVaultAddress,
  groupEventNonceFromId,
  projectContributionSummary,
  projectEventPoolSummary,
} from "@/solana/group-event";
import {
  prepareGroupEventCreation,
  prepareGroupEventFunding,
  prepareGroupEventPayout,
  prepareGroupEventRefund,
  prepareGroupEventSettlement,
  type GroupEventOperationKind,
  type PreparedGroupEventTransaction,
} from "@/solana/group-event-transaction";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  GroupEventOperationConflictError,
  activeGroupEventOperationRecord,
  failGroupEventOperationRecord,
  finalizeGroupEventOperationRecord,
  groupEventOperationContextRecord,
  groupEventOperationRecord,
  markGroupEventOperationSubmittedRecord,
  saveGroupEventPreparationRecord,
  type GroupEventOperationContext,
  type GroupEventOperationRecord,
} from "@/server/db/solana/group-event-repository";
import {
  markGroupEventProjectionAvailability,
  recordVerifiedGroupEventContributionProjection,
  recordVerifiedGroupEventPoolProjection,
} from "@/server/group-events/service";
import { coachPassDevnetConfig } from "./coach-pass-config";
import {
  CoachPassRpcError,
  createCoachPassRpcGateway,
  type CoachPassRpcGateway,
} from "./coach-pass-rpc";
import {
  readGroupEventCreationState,
  readGroupEventFundingState,
  readGroupEventPayoutState,
  readGroupEventPoolState,
  readGroupEventRefundState,
  simulatePreparedGroupEventTransaction,
  type GroupEventPoolChainState,
  type GroupEventRefundChainState,
} from "./group-event-rpc";
import {
  GroupEventSponsorValidationError,
  validateAndSponsorGroupEventTransaction,
} from "./group-event-sponsor";

type ActorStep<T> =
  | Readonly<{
      status: "authorized";
      actor: AuthorizedActor;
      value: T;
    }>
  | Readonly<{
      status:
        "preview" | "signed-out" | "forbidden" | "conflict" | "unavailable";
    }>;

async function actorStep<T>(
  work: Parameters<typeof withAuthorizedActor<T>>[0],
): Promise<ActorStep<T>> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        value: await work(transaction, actor),
      });
    } catch (error) {
      if (error instanceof GroupEventOperationConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (result.status !== "authorized") return result;
  if (result.value.outcome === "conflict") {
    return Object.freeze({ status: "conflict" as const });
  }
  return Object.freeze({
    status: "authorized" as const,
    actor: result.actor,
    value: result.value.value,
  });
}

function sameActor(left: AuthorizedActor, right: AuthorizedActor) {
  return (
    left.authUserId === right.authUserId &&
    left.profileId === right.profileId &&
    left.runId === right.runId &&
    left.runRole === right.runRole
  );
}

function nonAuthorizedResult(
  step: Exclude<ActorStep<unknown>, { status: "authorized" }>,
): GroupEventOperationApiResult {
  return Object.freeze({ status: step.status });
}

function snapshot(
  operation: GroupEventOperationRecord,
): GroupEventOperationSnapshot {
  if (operation.status === "prepared") {
    throw new GroupEventOperationConflictError();
  }
  return Object.freeze({
    status: operation.status,
    operationId: operation.operationId,
    operation: operation.operation,
    transactionSignature: operation.transactionSignature,
    failureCode: operation.failureCode,
    finalizedSlot: operation.finalizedSlot?.toString() ?? null,
  });
}

function preparedResult(
  operation: GroupEventOperationRecord,
): PreparedGroupEventOperationResult {
  return Object.freeze({
    status: "prepared",
    operationId: operation.operationId,
    prepared: operation.prepared,
    simulation: operation.simulation,
  });
}

function mapError(error: unknown): GroupEventOperationApiResult {
  if (error instanceof GroupEventOperationConflictError) {
    return Object.freeze({ status: "conflict" as const });
  }
  if (error instanceof CoachPassRpcError) {
    return Object.freeze({
      status: error.code === "rpc-unavailable" ? "unavailable" : "conflict",
    });
  }
  return Object.freeze({ status: "unavailable" as const });
}

function unixSeconds(value: string) {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new GroupEventOperationConflictError();
  }
  return BigInt(Math.floor(milliseconds / 1_000));
}

function currentUnixSeconds() {
  return BigInt(Math.floor(Date.now() / 1_000));
}

function operationForRequest(
  request: PrepareGroupEventOperationRequest,
): GroupEventOperationKind {
  switch (request.kind) {
    case "create":
      return "create-event-pool";
    case "fund":
      return "fund-event-seat";
    case "settle":
      return "settle-event-pool";
    case "payout":
      return "claim-event-payout";
    case "refund":
      return "claim-event-refund";
  }
}

function assertCoachIdentity(input: {
  actor: AuthorizedActor;
  context: GroupEventOperationContext;
  coachAuthority: Readonly<{
    runId: readonly number[];
    profileId: readonly number[];
    currentWallet: string;
  }>;
}) {
  if (
    input.context.coachProfileId !== input.actor.profileId ||
    seedToUuid(input.coachAuthority.runId) !== input.actor.runId ||
    seedToUuid(input.coachAuthority.profileId) !== input.actor.profileId ||
    input.coachAuthority.currentWallet !== input.context.walletAddress
  ) {
    throw new GroupEventOperationConflictError();
  }
}

function assertBoundEvent(input: {
  context: GroupEventOperationContext;
  programAddress: string;
}) {
  if (
    input.context.programAddress !== input.programAddress ||
    input.context.eventPoolAddress === null ||
    input.context.coachAuthorityAddress === null ||
    input.context.projectionAvailability === "unbound"
  ) {
    throw new GroupEventOperationConflictError();
  }
  return Object.freeze({
    eventPoolAddress: address(input.context.eventPoolAddress),
    coachAuthorityAddress: address(input.context.coachAuthorityAddress),
  });
}

async function loadPreparationContext(
  request: PrepareGroupEventOperationRequest,
) {
  const operation = operationForRequest(request);
  return actorStep(async (transaction, actor) => ({
    context: await groupEventOperationContextRecord(
      transaction,
      actor,
      request.eventId,
    ),
    active: await activeGroupEventOperationRecord(transaction, {
      eventId: request.eventId,
      operation,
    }),
  }));
}

async function prepareTransaction(input: {
  request: PrepareGroupEventOperationRequest;
  actor: AuthorizedActor;
  context: GroupEventOperationContext;
  rpc: CoachPassRpcGateway;
  programAddress: ReturnType<typeof address>;
  platformPayerAddress: ReturnType<typeof address>;
}): Promise<
  Readonly<{ prepared: PreparedGroupEventTransaction; slot: bigint }>
> {
  const common = {
    eventId: input.request.eventId,
    programAddress: input.programAddress,
    platformPayerAddress: input.platformPayerAddress,
  } as const;
  const walletAddress = address(input.context.walletAddress);

  if (input.request.kind === "create") {
    if (
      input.context.coachProfileId !== input.actor.profileId ||
      input.context.publicationStatus !== "draft"
    ) {
      throw new GroupEventOperationConflictError();
    }
    const coachAuthorityAddress = address(input.request.coachAuthorityAddress);
    const nonce = groupEventNonceFromId(input.request.eventId);
    const [eventPoolAddress] = await deriveEventPoolAddress({
      programAddress: input.programAddress,
      coachAuthority: coachAuthorityAddress,
      nonce,
    });
    const [vaultAddress] = await deriveEventVaultAddress({
      programAddress: input.programAddress,
      eventPool: eventPoolAddress,
    });
    if (
      input.context.projectionAvailability !== "unbound" &&
      (input.context.programAddress !== input.programAddress ||
        input.context.eventPoolAddress !== eventPoolAddress ||
        input.context.coachWalletAddressSnapshot !==
          input.context.walletAddress)
    ) {
      throw new GroupEventOperationConflictError();
    }
    const state = await readGroupEventCreationState({
      rpc: input.rpc,
      commitment: "confirmed",
      programAddress: input.programAddress,
      coachAuthorityAddress,
      eventPoolAddress,
      vaultAddress,
    });
    assertCoachIdentity({
      actor: input.actor,
      context: input.context,
      coachAuthority: state.coachAuthority,
    });
    const lifetimeConstraint = await input.rpc.latestBlockhash(state.slot);
    try {
      return Object.freeze({
        slot: state.slot,
        prepared: await prepareGroupEventCreation({
          ...common,
          lifetimeConstraint,
          coachWalletAddress: walletAddress,
          coachAuthorityAddress,
          coachAuthority: state.coachAuthority,
          nonce,
          seatPriceEurcBaseUnits: BigInt(input.request.seatPriceEurcBaseUnits),
          minimumParticipants: input.request.minimumParticipants,
          maximumParticipants: input.request.maximumParticipants,
          fundingDeadlineUnixSeconds: unixSeconds(
            input.request.fundingDeadline,
          ),
          eventStartUnixSeconds: unixSeconds(input.context.startsAt),
          eventEndUnixSeconds: unixSeconds(input.context.endsAt),
          currentUnixSeconds: currentUnixSeconds(),
        }),
      });
    } catch (error) {
      throw new GroupEventOperationConflictError(undefined, { cause: error });
    }
  }

  const bound = assertBoundEvent({
    context: input.context,
    programAddress: input.programAddress,
  });
  if (
    (input.request.kind === "fund" || input.request.kind === "settle") &&
    input.context.publicationStatus !== "published"
  ) {
    throw new GroupEventOperationConflictError();
  }

  try {
    if (input.request.kind === "fund") {
      const state = await readGroupEventFundingState({
        rpc: input.rpc,
        commitment: "confirmed",
        programAddress: input.programAddress,
        eventPoolAddress: bound.eventPoolAddress,
        participantWalletAddress: walletAddress,
      });
      if (state.eventPool.coachAuthority !== bound.coachAuthorityAddress) {
        throw new GroupEventOperationConflictError();
      }
      const lifetimeConstraint = await input.rpc.latestBlockhash(state.slot);
      return Object.freeze({
        slot: state.slot,
        prepared: await prepareGroupEventFunding({
          ...common,
          lifetimeConstraint,
          participantWalletAddress: walletAddress,
          eventPoolAddress: bound.eventPoolAddress,
          eventPool: state.eventPool,
          currentUnixSeconds: currentUnixSeconds(),
        }),
      });
    }

    if (input.request.kind === "settle") {
      const state = await readGroupEventPoolState({
        rpc: input.rpc,
        commitment: "confirmed",
        programAddress: input.programAddress,
        eventPoolAddress: bound.eventPoolAddress,
      });
      if (state.eventPool.coachAuthority !== bound.coachAuthorityAddress) {
        throw new GroupEventOperationConflictError();
      }
      const lifetimeConstraint = await input.rpc.latestBlockhash(state.slot);
      return Object.freeze({
        slot: state.slot,
        prepared: await prepareGroupEventSettlement({
          ...common,
          lifetimeConstraint,
          settlerWalletAddress: walletAddress,
          eventPoolAddress: bound.eventPoolAddress,
          eventPool: state.eventPool,
          currentUnixSeconds: currentUnixSeconds(),
        }),
      });
    }

    if (input.request.kind === "payout") {
      if (input.context.coachProfileId !== input.actor.profileId) {
        throw new GroupEventOperationConflictError();
      }
      const poolState = await readGroupEventPoolState({
        rpc: input.rpc,
        commitment: "confirmed",
        programAddress: input.programAddress,
        eventPoolAddress: bound.eventPoolAddress,
      });
      const state = await readGroupEventPayoutState({
        rpc: input.rpc,
        commitment: "confirmed",
        programAddress: input.programAddress,
        coachAuthorityAddress: bound.coachAuthorityAddress,
        eventPoolAddress: bound.eventPoolAddress,
        payoutRecipientAddress: poolState.eventPool.payoutRecipient,
        minContextSlot: poolState.slot,
      });
      assertCoachIdentity({
        actor: input.actor,
        context: input.context,
        coachAuthority: state.coachAuthority,
      });
      const lifetimeConstraint = await input.rpc.latestBlockhash(state.slot);
      return Object.freeze({
        slot: state.slot,
        prepared: await prepareGroupEventPayout({
          ...common,
          lifetimeConstraint,
          coachWalletAddress: walletAddress,
          coachAuthorityAddress: bound.coachAuthorityAddress,
          coachAuthority: state.coachAuthority,
          eventPoolAddress: bound.eventPoolAddress,
          eventPool: state.eventPool,
        }),
      });
    }

    const state = await readGroupEventRefundState({
      rpc: input.rpc,
      commitment: "confirmed",
      programAddress: input.programAddress,
      eventPoolAddress: bound.eventPoolAddress,
      participantWalletAddress: walletAddress,
    });
    if (state.eventPool.coachAuthority !== bound.coachAuthorityAddress) {
      throw new GroupEventOperationConflictError();
    }
    const lifetimeConstraint = await input.rpc.latestBlockhash(state.slot);
    return Object.freeze({
      slot: state.slot,
      prepared: await prepareGroupEventRefund({
        ...common,
        lifetimeConstraint,
        participantWalletAddress: walletAddress,
        eventPoolAddress: bound.eventPoolAddress,
        eventPool: state.eventPool,
        contributionAddress: state.contributionAddress,
        contribution: state.contribution,
      }),
    });
  } catch (error) {
    if (
      error instanceof CoachPassRpcError ||
      error instanceof GroupEventOperationConflictError
    ) {
      throw error;
    }
    throw new GroupEventOperationConflictError(undefined, { cause: error });
  }
}

export async function prepareGroupEventOperation(
  request: PrepareGroupEventOperationRequest,
): Promise<GroupEventOperationApiResult> {
  const loaded = await loadPreparationContext(request);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  if (loaded.value.active) {
    return loaded.value.active.status === "prepared"
      ? preparedResult(loaded.value.active)
      : snapshot(loaded.value.active);
  }

  try {
    const config = await coachPassDevnetConfig();
    const rpc = createCoachPassRpcGateway(config.serverRpcUrl);
    const result = await prepareTransaction({
      request,
      actor: loaded.actor,
      context: loaded.value.context,
      rpc,
      programAddress: config.programAddress,
      platformPayerAddress: config.sponsor.address,
    });
    const simulation = await simulatePreparedGroupEventTransaction({
      rpc,
      prepared: result.prepared,
      minContextSlot: result.slot,
    });
    const operationId = crypto.randomUUID();
    const saved = await actorStep(async (transaction, actor) => {
      if (!sameActor(loaded.actor, actor)) {
        throw new GroupEventOperationConflictError();
      }
      await saveGroupEventPreparationRecord(transaction, {
        operationId,
        eventId: request.eventId,
        prepared: result.prepared,
        simulationSlot: simulation.slot,
        simulationUnitsConsumed: simulation.unitsConsumed,
      });
      return operationId;
    });
    if (saved.status !== "authorized") return nonAuthorizedResult(saved);
    return Object.freeze({
      status: "prepared",
      operationId,
      prepared: result.prepared,
      simulation: Object.freeze({
        slot: simulation.slot.toString(),
        unitsConsumed: simulation.unitsConsumed?.toString() ?? null,
      }),
    });
  } catch (error) {
    return mapError(error);
  }
}

async function loadOperation(operationId: string) {
  return actorStep((transaction) =>
    groupEventOperationRecord(transaction, operationId),
  );
}

async function markFailure(
  actor: AuthorizedActor,
  operation: GroupEventOperationRecord,
  status: "failed" | "expired",
  failureCode:
    | "wallet-rejected"
    | "simulation-failed"
    | "blockhash-expired"
    | "transaction-failed"
    | "state-not-observed",
): Promise<GroupEventOperationApiResult> {
  const result = await actorStep(async (transaction, currentActor) => {
    if (!sameActor(actor, currentActor)) {
      throw new GroupEventOperationConflictError();
    }
    await failGroupEventOperationRecord(
      transaction,
      operation,
      status,
      failureCode,
    );
  });
  if (result.status !== "authorized") return nonAuthorizedResult(result);
  return Object.freeze({
    status,
    operationId: operation.operationId,
    operation: operation.operation,
    transactionSignature: operation.transactionSignature,
    failureCode,
    finalizedSlot: null,
  });
}

export async function submitGroupEventOperation(
  request: SubmitGroupEventOperationRequest,
): Promise<GroupEventOperationApiResult> {
  const loaded = await loadOperation(request.operationId);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  const operation = loaded.value;
  if (operation.status !== "prepared") return snapshot(operation);

  try {
    const config = await coachPassDevnetConfig();
    if (operation.programAddress !== config.programAddress) {
      throw new GroupEventOperationConflictError();
    }
    const rpc = createCoachPassRpcGateway(config.serverRpcUrl);
    if (
      (await rpc.blockHeight("confirmed")) >
      BigInt(operation.prepared.lastValidBlockHeight)
    ) {
      return markFailure(
        loaded.actor,
        operation,
        "expired",
        "blockhash-expired",
      );
    }
    let sponsored;
    try {
      sponsored = await validateAndSponsorGroupEventTransaction({
        prepared: operation.prepared,
        walletSignedTransactionBase64: request.walletSignedTransactionBase64,
        sponsor: config.sponsor,
      });
    } catch (error) {
      if (error instanceof GroupEventSponsorValidationError) {
        return Object.freeze({
          status: "invalid-request",
          reason: error.code,
        });
      }
      throw error;
    }
    const submitted = await actorStep(async (transaction, actor) => {
      if (!sameActor(loaded.actor, actor)) {
        throw new GroupEventOperationConflictError();
      }
      await markGroupEventOperationSubmittedRecord(
        transaction,
        operation,
        sponsored.transactionSignature,
      );
    });
    if (submitted.status !== "authorized") {
      return nonAuthorizedResult(submitted);
    }
    try {
      const returnedSignature = await rpc.send(
        sponsored.transactionBase64,
        BigInt(operation.simulation.slot),
      );
      if (returnedSignature !== sponsored.transactionSignature) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "RPC returned an unexpected transaction identity.",
        );
      }
    } catch {
      // The durable submitted state is recovered by deterministic signature.
    }
    return Object.freeze({
      status: "submitted",
      operationId: operation.operationId,
      operation: operation.operation,
      transactionSignature: sponsored.transactionSignature,
      failureCode: null,
      finalizedSlot: null,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function rejectGroupEventOperation(
  operationId: string,
): Promise<GroupEventOperationApiResult> {
  const loaded = await loadOperation(operationId);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  if (loaded.value.status !== "prepared") return snapshot(loaded.value);
  return markFailure(loaded.actor, loaded.value, "failed", "wallet-rejected");
}

export type FinalizedGroupEventState =
  | Readonly<{ kind: "pool"; state: GroupEventPoolChainState }>
  | Readonly<{ kind: "contribution"; state: GroupEventRefundChainState }>;

async function readFinalizedState(input: {
  rpc: CoachPassRpcGateway;
  operation: GroupEventOperationRecord;
  minContextSlot?: bigint;
}): Promise<FinalizedGroupEventState> {
  const common = {
    rpc: input.rpc,
    commitment: "finalized" as const,
    programAddress: address(input.operation.programAddress),
    eventPoolAddress: address(input.operation.eventPoolAddress),
    ...(input.minContextSlot === undefined
      ? {}
      : { minContextSlot: input.minContextSlot }),
  };
  if (
    input.operation.operation === "fund-event-seat" ||
    input.operation.operation === "claim-event-refund"
  ) {
    return Object.freeze({
      kind: "contribution" as const,
      state: await readGroupEventRefundState({
        ...common,
        participantWalletAddress: address(input.operation.authorityAddress),
      }),
    });
  }
  return Object.freeze({
    kind: "pool" as const,
    state: await readGroupEventPoolState(common),
  });
}

function lifecycleStatus(status: EventPoolStatus) {
  switch (status) {
    case EventPoolStatus.Funding:
      return "funding" as const;
    case EventPoolStatus.Succeeded:
      return "succeeded" as const;
    case EventPoolStatus.Paid:
      return "paid" as const;
    case EventPoolStatus.Failed:
      return "failed" as const;
  }
}

export function verifiedGroupEventEvidence(input: {
  operation: GroupEventOperationRecord;
  finalized: FinalizedGroupEventState;
  signature: string;
}) {
  const state = input.finalized.state;
  const summary = input.operation.prepared.summary;
  const pool = projectEventPoolSummary({
    pool: state.eventPool,
    expectedCoachAuthority: address(input.operation.coachAuthorityAddress),
    expectedVault: address(input.operation.vaultAddress),
  });
  if (
    summary.eventId !== input.operation.eventId ||
    summary.eventPoolAddress !== input.operation.eventPoolAddress ||
    summary.vaultAddress !== input.operation.vaultAddress ||
    summary.coachAuthorityAddress !== input.operation.coachAuthorityAddress ||
    pool.paymentMint !== DEVNET_EURC_MINT_ADDRESS
  ) {
    return null;
  }
  switch (input.operation.operation) {
    case "create-event-pool":
      if (
        summary.operation !== "create-event-pool" ||
        pool.status !== EventPoolStatus.Funding ||
        pool.participantCount !== 0 ||
        pool.totalFundedBaseUnits !== BigInt(0) ||
        pool.nonce.toString() !== summary.nonce ||
        pool.payoutRecipient !== summary.payoutRecipientAddress ||
        pool.priceEurcBaseUnits.toString() !== summary.seatPriceEurcBaseUnits ||
        pool.minimumParticipants !== summary.minimumParticipants ||
        pool.maximumParticipants !== summary.maximumParticipants ||
        pool.fundingDeadline.toString() !==
          summary.fundingDeadlineUnixSeconds ||
        pool.eventStartAt.toString() !== summary.eventStartUnixSeconds ||
        pool.eventEndAt.toString() !== summary.eventEndUnixSeconds
      ) {
        return null;
      }
      break;
    case "fund-event-seat":
      if (
        summary.operation !== "fund-event-seat" ||
        input.finalized.kind !== "contribution" ||
        summary.contributionAddress !== input.operation.contributionAddress ||
        input.finalized.state.contributionAddress !==
          input.operation.contributionAddress ||
        summary.seatPriceEurcBaseUnits !== pool.priceEurcBaseUnits.toString() ||
        input.finalized.state.contribution.status !== ContributionStatus.Funded
      ) {
        return null;
      }
      break;
    case "settle-event-pool":
      if (
        summary.operation !== "settle-event-pool" ||
        pool.participantCount !== summary.participantCount ||
        pool.minimumParticipants !== summary.minimumParticipants ||
        (summary.expectedOutcome === "succeeded"
          ? pool.status !== EventPoolStatus.Succeeded
          : pool.status !== EventPoolStatus.Failed)
      ) {
        return null;
      }
      break;
    case "claim-event-payout":
      if (
        summary.operation !== "claim-event-payout" ||
        pool.status !== EventPoolStatus.Paid ||
        summary.payoutRecipientAddress !== pool.payoutRecipient ||
        summary.amountEurcBaseUnits !== pool.totalFundedBaseUnits.toString()
      ) {
        return null;
      }
      break;
    case "claim-event-refund":
      if (
        summary.operation !== "claim-event-refund" ||
        input.finalized.kind !== "contribution" ||
        pool.status !== EventPoolStatus.Failed ||
        input.finalized.state.contributionAddress !==
          input.operation.contributionAddress ||
        summary.amountEurcBaseUnits !== pool.priceEurcBaseUnits.toString() ||
        input.finalized.state.contribution.status !==
          ContributionStatus.Refunded
      ) {
        return null;
      }
      break;
  }

  const observedAt = new Date().toISOString();
  const poolEvidence: VerifiedGroupEventPoolProjection = Object.freeze({
    eventId: input.operation.eventId,
    programAddress: input.operation.programAddress,
    eventPoolAddress: input.operation.eventPoolAddress,
    vaultAddress: input.operation.vaultAddress,
    coachAuthorityAddress: input.operation.coachAuthorityAddress,
    payoutRecipientAddress: pool.payoutRecipient,
    mintAddress: pool.paymentMint,
    tokenProgramAddress: TOKEN_PROGRAM_ADDRESS,
    seatPriceBaseUnits: pool.priceEurcBaseUnits,
    minimumParticipants: pool.minimumParticipants,
    maximumParticipants: pool.maximumParticipants,
    participantCount: pool.participantCount,
    fundingDeadline: new Date(
      Number(pool.fundingDeadline) * 1_000,
    ).toISOString(),
    eventStartsAt: new Date(Number(pool.eventStartAt) * 1_000).toISOString(),
    eventEndsAt: new Date(Number(pool.eventEndAt) * 1_000).toISOString(),
    lifecycleStatus: lifecycleStatus(pool.status),
    transactionSignature: input.signature,
    observedSlot: state.slot,
    finalizedAt: observedAt,
  });
  if (input.finalized.kind !== "contribution") {
    return Object.freeze({ pool: poolEvidence, contribution: null });
  }
  const contribution = projectContributionSummary({
    contribution: input.finalized.state.contribution,
    expectedEventPool: address(input.operation.eventPoolAddress),
    expectedParticipantWallet: address(input.operation.authorityAddress),
    expectedAmountEurcBaseUnits: pool.priceEurcBaseUnits,
  });
  const contributionLifecycle =
    contribution.status === ContributionStatus.Refunded
      ? ("refunded" as const)
      : pool.status === EventPoolStatus.Failed
        ? ("refundable" as const)
        : pool.status === EventPoolStatus.Funding
          ? ("funded" as const)
          : ("successful" as const);
  const contributionEvidence: VerifiedGroupEventContributionProjection =
    Object.freeze({
      eventId: input.operation.eventId,
      programAddress: input.operation.programAddress,
      eventPoolAddress: input.operation.eventPoolAddress,
      contributionAddress: input.finalized.state.contributionAddress,
      participantWalletAddress: contribution.participantWallet,
      amountBaseUnits: contribution.amountEurcBaseUnits,
      lifecycleStatus: contributionLifecycle,
      transactionSignature: input.signature,
      observedSlot: state.slot,
      finalizedAt: observedAt,
    });
  return Object.freeze({
    pool: poolEvidence,
    contribution: contributionEvidence,
  });
}

async function finalizeObservedOperation(input: {
  actor: AuthorizedActor;
  operation: GroupEventOperationRecord;
  finalized: FinalizedGroupEventState;
  signature: string;
}): Promise<GroupEventOperationApiResult | null> {
  const evidence = verifiedGroupEventEvidence(input);
  if (!evidence) return null;
  await recordVerifiedGroupEventPoolProjection(evidence.pool);
  if (evidence.contribution) {
    await recordVerifiedGroupEventContributionProjection(evidence.contribution);
  }
  const saved = await actorStep(async (transaction, actor) => {
    if (!sameActor(input.actor, actor)) {
      throw new GroupEventOperationConflictError();
    }
    await finalizeGroupEventOperationRecord(
      transaction,
      input.operation,
      evidence.pool.observedSlot,
    );
  });
  if (saved.status !== "authorized") return nonAuthorizedResult(saved);
  return Object.freeze({
    status: "finalized",
    operationId: input.operation.operationId,
    operation: input.operation.operation,
    transactionSignature: input.signature,
    failureCode: null,
    finalizedSlot: evidence.pool.observedSlot.toString(),
  });
}

async function markProjectionUnavailable(operation: GroupEventOperationRecord) {
  try {
    await markGroupEventProjectionAvailability({
      eventId: operation.eventId,
      programAddress: operation.programAddress,
      eventPoolAddress: operation.eventPoolAddress,
      availability: "unavailable",
    });
  } catch {
    // The original recovery failure remains the caller-facing result.
  }
}

export async function recoverGroupEventOperation(
  operationId: string,
): Promise<GroupEventOperationApiResult> {
  const loaded = await loadOperation(operationId);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  const operation = loaded.value;
  if (
    operation.status === "finalized" ||
    operation.status === "failed" ||
    operation.status === "expired"
  ) {
    return snapshot(operation);
  }

  try {
    const config = await coachPassDevnetConfig();
    if (operation.programAddress !== config.programAddress) {
      throw new GroupEventOperationConflictError();
    }
    const rpc = createCoachPassRpcGateway(config.serverRpcUrl);
    const lastValidBlockHeight = BigInt(
      operation.prepared.lastValidBlockHeight,
    );
    if (operation.status === "prepared") {
      if ((await rpc.blockHeight("confirmed")) > lastValidBlockHeight) {
        return markFailure(
          loaded.actor,
          operation,
          "expired",
          "blockhash-expired",
        );
      }
      return preparedResult(operation);
    }

    const transactionSignature = operation.transactionSignature;
    if (!transactionSignature) throw new GroupEventOperationConflictError();
    const signatureStatus = await rpc.signatureStatus(transactionSignature);
    if (signatureStatus?.error !== null && signatureStatus !== null) {
      return markFailure(
        loaded.actor,
        operation,
        "failed",
        "transaction-failed",
      );
    }
    if (signatureStatus?.confirmationStatus === "finalized") {
      const finalized = await readFinalizedState({
        rpc,
        operation,
        minContextSlot: signatureStatus.slot,
      });
      return (
        (await finalizeObservedOperation({
          actor: loaded.actor,
          operation,
          finalized,
          signature: transactionSignature,
        })) ?? Object.freeze({ status: "conflict" as const })
      );
    }
    if (signatureStatus !== null) return snapshot(operation);
    if ((await rpc.blockHeight("finalized")) <= lastValidBlockHeight) {
      return snapshot(operation);
    }

    const finalized = await readFinalizedState({ rpc, operation });
    const recovered = await finalizeObservedOperation({
      actor: loaded.actor,
      operation,
      finalized,
      signature: transactionSignature,
    });
    if (recovered) return recovered;
    return markFailure(
      loaded.actor,
      operation,
      "expired",
      "state-not-observed",
    );
  } catch (error) {
    if (
      error instanceof CoachPassRpcError &&
      error.code === "rpc-unavailable" &&
      operation.status === "submitted"
    ) {
      await markProjectionUnavailable(operation);
    }
    return mapError(error);
  }
}
