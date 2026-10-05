import "server-only";

import { address } from "@solana/kit";
import { CreditReservationStatus } from "../../../clients/js/src/generated/types/creditReservationStatus";
import type {
  VerifiedBookingCreditOperation,
  VerifiedCoachCreditProjection,
} from "@/domain/coach-bookings";
import {
  projectCoachClientCreditSummary,
  projectCreditReservationSummary,
  seedToUuid,
} from "@/solana/coach-pass";
import type {
  CoachPassOperationApiResult,
  CoachPassOperationSnapshot,
  PrepareCoachPassOperationRequest,
  PreparedCoachPassOperationResult,
  SubmitCoachPassOperationRequest,
} from "@/solana/coach-pass-operation";
import {
  prepareCoachPassPurchase,
  prepareCoachPassReservation,
  prepareCoachPassResolution,
} from "@/solana/coach-pass-transaction";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  CoachPassOperationConflictError,
  coachPassBookingContextRecord,
  coachPassOperationRecord,
  coachPassPurchaseContextRecord,
  failCoachPassOperationRecord,
  finalizeCoachPassBookingRecord,
  finalizeCoachPassPurchaseRecord,
  markCoachPassOperationSubmittedRecord,
  saveCoachPassBookingPreparationRecord,
  saveCoachPassPurchasePreparationRecord,
  type CoachPassOperationRecord,
} from "@/server/db/solana/coach-pass-repository";
import { coachPassDevnetConfig } from "./coach-pass-config";
import {
  CoachPassRpcError,
  createCoachPassRpcGateway,
  readCoachPassBookingState,
  readCoachPassPurchaseState,
  simulatePreparedCoachPassTransaction,
  type CoachPassBookingChainState,
  type CoachPassPurchaseChainState,
  type CoachPassRpcGateway,
} from "./coach-pass-rpc";
import { validateAndSponsorCoachPassTransaction } from "./coach-pass-sponsor";

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
      if (error instanceof CoachPassOperationConflictError) {
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
): CoachPassOperationApiResult {
  return Object.freeze({ status: step.status });
}

function snapshot(
  operation: CoachPassOperationRecord,
): CoachPassOperationSnapshot {
  if (operation.status === "prepared") {
    throw new CoachPassOperationConflictError();
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
  operation: CoachPassOperationRecord,
): PreparedCoachPassOperationResult {
  if (!operation.prepared || !operation.simulation) {
    throw new CoachPassOperationConflictError();
  }
  return Object.freeze({
    status: "prepared",
    operationId: operation.operationId,
    prepared: operation.prepared,
    simulation: operation.simulation,
  });
}

function mapError(error: unknown): CoachPassOperationApiResult {
  if (error instanceof CoachPassOperationConflictError) {
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
    throw new CoachPassOperationConflictError();
  }
  return BigInt(Math.floor(milliseconds / 1_000));
}

function currentUnixSeconds() {
  return BigInt(Math.floor(Date.now() / 1_000));
}

function assertCoachAuthorityIdentity(input: {
  actorRunId: string;
  coachProfileId: string;
  chainState: CoachPassPurchaseChainState | CoachPassBookingChainState;
}) {
  if (
    seedToUuid(input.chainState.coachAuthority.runId) !== input.actorRunId ||
    seedToUuid(input.chainState.coachAuthority.profileId) !==
      input.coachProfileId
  ) {
    throw new CoachPassOperationConflictError();
  }
}

function rpcGateway(rpcUrl: string) {
  return createCoachPassRpcGateway(rpcUrl);
}

async function savePreparedPurchase(input: {
  actor: AuthorizedActor;
  coachProfileId: string;
  prepared: Awaited<ReturnType<typeof prepareCoachPassPurchase>>;
  simulation: Awaited<ReturnType<typeof simulatePreparedCoachPassTransaction>>;
  chainState: CoachPassPurchaseChainState;
}) {
  const operationId = crypto.randomUUID();
  const baseline = input.chainState.coachClientCredits;
  const saved = await actorStep((transaction, actor) => {
    if (!sameActor(input.actor, actor)) {
      throw new CoachPassOperationConflictError();
    }
    return saveCoachPassPurchasePreparationRecord(transaction, {
      operationId,
      coachProfileId: input.coachProfileId,
      prepared: input.prepared,
      simulationSlot: input.simulation.slot,
      simulationUnitsConsumed: input.simulation.unitsConsumed,
      baselineLedgerExists: baseline !== null,
      baselineAvailableCredits: baseline?.availableCredits ?? BigInt(0),
      baselineReservedCredits: baseline?.reservedCredits ?? BigInt(0),
      baselineTotalPurchased: baseline?.totalPurchased ?? BigInt(0),
      baselinePurchaseCount: baseline?.purchaseCount ?? BigInt(0),
    });
  });
  if (saved.status !== "authorized") return nonAuthorizedResult(saved);
  return Object.freeze({
    status: "prepared" as const,
    operationId: saved.value,
    prepared: input.prepared,
    simulation: Object.freeze({
      slot: input.simulation.slot.toString(),
      unitsConsumed: input.simulation.unitsConsumed?.toString() ?? null,
    }),
  });
}

async function preparePurchaseOperation(
  request: Extract<PrepareCoachPassOperationRequest, { kind: "purchase" }>,
): Promise<CoachPassOperationApiResult> {
  const context = await actorStep((transaction, actor) =>
    coachPassPurchaseContextRecord(transaction, actor, request.coachProfileId),
  );
  if (context.status !== "authorized") return nonAuthorizedResult(context);

  try {
    const config = await coachPassDevnetConfig();
    const rpc = rpcGateway(config.serverRpcUrl);
    const chainState = await readCoachPassPurchaseState({
      rpc,
      commitment: "confirmed",
      programAddress: config.programAddress,
      coachAuthorityAddress: address(request.coachAuthorityAddress),
      offerAddress: address(request.offerAddress),
      clientWalletAddress: address(context.value.walletAddress),
    });
    assertCoachAuthorityIdentity({
      actorRunId: context.actor.runId,
      coachProfileId: request.coachProfileId,
      chainState,
    });
    const lifetimeConstraint = await rpc.latestBlockhash(chainState.slot);
    const prepared = await prepareCoachPassPurchase({
      programAddress: config.programAddress,
      platformPayerAddress: config.sponsor.address,
      lifetimeConstraint,
      clientWalletAddress: address(context.value.walletAddress),
      coachAuthorityAddress: address(request.coachAuthorityAddress),
      coachAuthority: chainState.coachAuthority,
      offerAddress: address(request.offerAddress),
      offer: chainState.offer,
      coachClientCredits: chainState.coachClientCredits,
      currentUnixSeconds: currentUnixSeconds(),
    });
    const simulation = await simulatePreparedCoachPassTransaction({
      rpc,
      prepared,
      minContextSlot: chainState.slot,
    });
    return savePreparedPurchase({
      actor: context.actor,
      coachProfileId: request.coachProfileId,
      prepared,
      simulation,
      chainState,
    });
  } catch (error) {
    return mapError(error);
  }
}

async function markFailure(
  actor: AuthorizedActor,
  operation: CoachPassOperationRecord,
  status: "failed" | "expired",
  reason:
    | "wallet-rejected"
    | "simulation-failed"
    | "blockhash-expired"
    | "transaction-failed"
    | "state-not-observed",
) {
  const result = await actorStep((transaction, currentActor) => {
    if (!sameActor(actor, currentActor)) {
      throw new CoachPassOperationConflictError();
    }
    return failCoachPassOperationRecord(transaction, operation, status, reason);
  });
  if (result.status !== "authorized") return nonAuthorizedResult(result);
  return Object.freeze({
    status,
    operationId: operation.operationId,
    operation: operation.operation,
    transactionSignature: operation.transactionSignature,
    failureCode: reason,
    finalizedSlot: null,
  });
}

async function prepareBookingOperation(
  request: Extract<PrepareCoachPassOperationRequest, { kind: "booking" }>,
): Promise<CoachPassOperationApiResult> {
  const context = await actorStep((transaction, actor) =>
    coachPassBookingContextRecord(transaction, actor, request.operationId),
  );
  if (context.status !== "authorized") return nonAuthorizedResult(context);
  const operation = context.value.operation;
  if (operation.status === "submitted" || operation.status === "finalized") {
    return snapshot(operation);
  }
  if (
    operation.booking?.kind === "reserve" &&
    operation.status !== "prepared"
  ) {
    return Object.freeze({ status: "conflict" });
  }

  try {
    const config = await coachPassDevnetConfig();
    if (operation.programAddress !== config.programAddress) {
      throw new CoachPassOperationConflictError();
    }
    if (!operation.booking) throw new CoachPassOperationConflictError();
    const rpc = rpcGateway(config.serverRpcUrl);
    const chainState = await readCoachPassBookingState({
      rpc,
      commitment: "confirmed",
      programAddress: config.programAddress,
      coachAuthorityAddress: address(operation.coachAuthorityAddress),
      coachClientCreditsAddress: address(operation.coachClientCreditsAddress),
      creditReservationAddress: address(
        operation.booking.creditReservationAddress,
      ),
    });
    assertCoachAuthorityIdentity({
      actorRunId: context.actor.runId,
      coachProfileId: operation.coachProfileId,
      chainState,
    });
    const lifetimeConstraint = await rpc.latestBlockhash(chainState.slot);
    let prepared;
    if (operation.booking.kind === "reserve") {
      if (chainState.creditReservation !== null) {
        throw new CoachPassOperationConflictError();
      }
      prepared = await prepareCoachPassReservation({
        programAddress: config.programAddress,
        platformPayerAddress: config.sponsor.address,
        lifetimeConstraint,
        clientWalletAddress: address(context.value.walletAddress),
        coachAuthorityAddress: address(operation.coachAuthorityAddress),
        coachAuthority: chainState.coachAuthority,
        coachClientCreditsAddress: address(operation.coachClientCreditsAddress),
        coachClientCredits: chainState.coachClientCredits,
        bookingId: operation.booking.bookingId,
        scheduledStartUnixSeconds: unixSeconds(
          operation.booking.scheduledStartAt,
        ),
        earlyReturnUntilUnixSeconds: unixSeconds(
          operation.booking.earlyReturnUntil,
        ),
      });
    } else {
      if (chainState.creditReservation === null) {
        throw new CoachPassOperationConflictError();
      }
      prepared = await prepareCoachPassResolution({
        programAddress: config.programAddress,
        platformPayerAddress: config.sponsor.address,
        lifetimeConstraint,
        resolution: operation.booking.kind === "return" ? "return" : "consume",
        authorityAddress: address(context.value.walletAddress),
        coachAuthorityAddress: address(operation.coachAuthorityAddress),
        coachAuthority: chainState.coachAuthority,
        coachClientCreditsAddress: address(operation.coachClientCreditsAddress),
        coachClientCredits: chainState.coachClientCredits,
        creditReservationAddress: address(
          operation.booking.creditReservationAddress,
        ),
        creditReservation: chainState.creditReservation,
        currentUnixSeconds: currentUnixSeconds(),
      });
    }
    const simulation = await simulatePreparedCoachPassTransaction({
      rpc,
      prepared,
      minContextSlot: chainState.slot,
    });
    const saved = await actorStep((transaction, actor) => {
      if (!sameActor(context.actor, actor)) {
        throw new CoachPassOperationConflictError();
      }
      return saveCoachPassBookingPreparationRecord(transaction, {
        operationId: operation.operationId,
        prepared,
        simulationSlot: simulation.slot,
        simulationUnitsConsumed: simulation.unitsConsumed,
      });
    });
    if (saved.status !== "authorized") return nonAuthorizedResult(saved);
    return Object.freeze({
      status: "prepared",
      operationId: saved.value,
      prepared,
      simulation: Object.freeze({
        slot: simulation.slot.toString(),
        unitsConsumed: simulation.unitsConsumed?.toString() ?? null,
      }),
    });
  } catch (error) {
    if (
      error instanceof CoachPassRpcError &&
      error.code === "simulation-failed"
    ) {
      return markFailure(
        context.actor,
        operation,
        "failed",
        "simulation-failed",
      );
    }
    return mapError(error);
  }
}

export function prepareCoachPassOperation(
  request: PrepareCoachPassOperationRequest,
) {
  return request.kind === "purchase"
    ? preparePurchaseOperation(request)
    : prepareBookingOperation(request);
}

async function loadOperation(operationId: string) {
  return actorStep((transaction) =>
    coachPassOperationRecord(transaction, operationId),
  );
}

async function markSubmitted(input: {
  actor: AuthorizedActor;
  operation: CoachPassOperationRecord;
  transactionSignature: string;
}) {
  return actorStep((transaction, actor) => {
    if (!sameActor(input.actor, actor)) {
      throw new CoachPassOperationConflictError();
    }
    return markCoachPassOperationSubmittedRecord(
      transaction,
      input.operation,
      input.transactionSignature,
    );
  });
}

export async function submitCoachPassOperation(
  request: SubmitCoachPassOperationRequest,
): Promise<CoachPassOperationApiResult> {
  const loaded = await loadOperation(request.operationId);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  const operation = loaded.value;
  if (operation.status !== "prepared") return snapshot(operation);
  if (!operation.prepared) return Object.freeze({ status: "conflict" });

  try {
    const config = await coachPassDevnetConfig();
    if (operation.programAddress !== config.programAddress) {
      throw new CoachPassOperationConflictError();
    }
    const rpc = rpcGateway(config.serverRpcUrl);
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
      sponsored = await validateAndSponsorCoachPassTransaction({
        prepared: operation.prepared,
        walletSignedTransactionBase64: request.walletSignedTransactionBase64,
        sponsor: config.sponsor,
      });
    } catch {
      return Object.freeze({ status: "invalid-request" });
    }
    const submitted = await markSubmitted({
      actor: loaded.actor,
      operation,
      transactionSignature: sponsored.transactionSignature,
    });
    if (submitted.status !== "authorized") {
      return nonAuthorizedResult(submitted);
    }
    try {
      const returnedSignature = await rpc.send(
        sponsored.transactionBase64,
        operation.simulation ? BigInt(operation.simulation.slot) : undefined,
      );
      if (returnedSignature !== sponsored.transactionSignature) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "RPC returned an unexpected transaction identity.",
        );
      }
    } catch {
      // Submission is deliberately retained as ambiguous and recovered by signature.
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

export async function rejectCoachPassOperation(
  operationId: string,
): Promise<CoachPassOperationApiResult> {
  const loaded = await loadOperation(operationId);
  if (loaded.status !== "authorized") return nonAuthorizedResult(loaded);
  if (loaded.value.status !== "prepared") return snapshot(loaded.value);
  return markFailure(loaded.actor, loaded.value, "failed", "wallet-rejected");
}

export function verifiedCoachPassPurchaseProjection(input: {
  operation: CoachPassOperationRecord;
  state: CoachPassPurchaseChainState;
  signature: string;
}): VerifiedCoachCreditProjection | null {
  const purchase = input.operation.purchase;
  const credits = input.state.coachClientCredits;
  if (!purchase || !credits) return null;
  const summary = projectCoachClientCreditSummary({
    credits,
    expectedCoachAuthority: address(input.operation.coachAuthorityAddress),
    expectedClientWallet: address(input.operation.clientWalletAddress),
  });
  if (
    summary.availableCredits !==
      purchase.baselineAvailableCredits + BigInt(purchase.creditsPurchased) ||
    summary.reservedCredits !== purchase.baselineReservedCredits ||
    summary.totalPurchased !==
      purchase.baselineTotalPurchased + BigInt(purchase.creditsPurchased) ||
    summary.purchaseCount !== purchase.baselinePurchaseCount + BigInt(1) ||
    summary.nextPurchaseNonce !== purchase.expectedPurchaseNonce + BigInt(1) ||
    summary.lastOffer !== purchase.offerAddress
  ) {
    return null;
  }
  return Object.freeze({
    programAddress: input.operation.programAddress,
    coachProfileId: input.operation.coachProfileId,
    coachAuthorityAddress: input.operation.coachAuthorityAddress,
    clientWalletAddress: input.operation.clientWalletAddress,
    coachClientCreditsAddress: input.operation.coachClientCreditsAddress,
    availableCredits: summary.availableCredits,
    reservedCredits: summary.reservedCredits,
    totalPurchased: summary.totalPurchased,
    purchaseCount: summary.purchaseCount,
    nextPurchaseNonce: summary.nextPurchaseNonce,
    lastOfferAddress: summary.lastOffer,
    lastPurchaseAt: new Date(
      Number(summary.lastPurchaseAt) * 1_000,
    ).toISOString(),
    transactionSignature: input.signature,
    observedSlot: input.state.slot,
  });
}

export function verifiedCoachPassBookingEvidence(input: {
  operation: CoachPassOperationRecord;
  state: CoachPassBookingChainState;
  signature: string;
}): VerifiedBookingCreditOperation | null {
  const booking = input.operation.booking;
  const reservation = input.state.creditReservation;
  if (!booking || !reservation) return null;
  const credits = projectCoachClientCreditSummary({
    credits: input.state.coachClientCredits,
    expectedCoachAuthority: address(input.operation.coachAuthorityAddress),
    expectedClientWallet: address(input.operation.clientWalletAddress),
  });
  const projectedReservation = projectCreditReservationSummary({
    reservation,
    expectedCoachClientCredits: address(
      input.operation.coachClientCreditsAddress,
    ),
    expectedCoachAuthority: address(input.operation.coachAuthorityAddress),
    expectedClientWallet: address(input.operation.clientWalletAddress),
    expectedBookingId: booking.bookingId,
  });
  const expectedStatus =
    booking.kind === "reserve"
      ? CreditReservationStatus.Reserved
      : booking.kind === "return"
        ? CreditReservationStatus.Returned
        : CreditReservationStatus.Consumed;
  if (
    projectedReservation.status !== expectedStatus ||
    projectedReservation.scheduledStartAt !==
      unixSeconds(booking.scheduledStartAt) ||
    projectedReservation.earlyReturnUntil !==
      unixSeconds(booking.earlyReturnUntil)
  ) {
    return null;
  }
  return Object.freeze({
    operationId: input.operation.operationId,
    programAddress: input.operation.programAddress,
    coachAuthorityAddress: input.operation.coachAuthorityAddress,
    clientWalletAddress: input.operation.clientWalletAddress,
    coachClientCreditsAddress: input.operation.coachClientCreditsAddress,
    creditReservationAddress: booking.creditReservationAddress,
    bookingId: booking.bookingId,
    scheduledStartUnixSeconds: projectedReservation.scheduledStartAt,
    earlyReturnUntilUnixSeconds: projectedReservation.earlyReturnUntil,
    reservationStatus:
      expectedStatus === CreditReservationStatus.Reserved
        ? "reserved"
        : expectedStatus === CreditReservationStatus.Returned
          ? "returned"
          : "consumed",
    availableCredits: credits.availableCredits,
    reservedCredits: credits.reservedCredits,
    totalPurchased: credits.totalPurchased,
    transactionSignature: input.signature,
    observedSlot: input.state.slot,
  });
}

async function readFinalizedState(input: {
  rpc: CoachPassRpcGateway;
  operation: CoachPassOperationRecord;
  minContextSlot?: bigint;
}) {
  if (input.operation.recordType === "purchase") {
    const purchase = input.operation.purchase;
    if (!purchase) throw new CoachPassOperationConflictError();
    return readCoachPassPurchaseState({
      rpc: input.rpc,
      commitment: "finalized",
      programAddress: address(input.operation.programAddress),
      coachAuthorityAddress: address(input.operation.coachAuthorityAddress),
      offerAddress: address(purchase.offerAddress),
      clientWalletAddress: address(input.operation.clientWalletAddress),
      requireSufficientClientBalance: false,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    });
  }
  const booking = input.operation.booking;
  if (!booking) throw new CoachPassOperationConflictError();
  return readCoachPassBookingState({
    rpc: input.rpc,
    commitment: "finalized",
    programAddress: address(input.operation.programAddress),
    coachAuthorityAddress: address(input.operation.coachAuthorityAddress),
    coachClientCreditsAddress: address(
      input.operation.coachClientCreditsAddress,
    ),
    creditReservationAddress: address(booking.creditReservationAddress),
    ...(input.minContextSlot === undefined
      ? {}
      : { minContextSlot: input.minContextSlot }),
  });
}

async function finalizeObservedOperation(input: {
  actor: AuthorizedActor;
  operation: CoachPassOperationRecord;
  state: CoachPassPurchaseChainState | CoachPassBookingChainState;
  signature: string;
}): Promise<CoachPassOperationApiResult | null> {
  if (input.operation.recordType === "purchase") {
    const projection = verifiedCoachPassPurchaseProjection({
      operation: input.operation,
      state: input.state as CoachPassPurchaseChainState,
      signature: input.signature,
    });
    if (!projection) return null;
    const saved = await actorStep(async (transaction, actor) => {
      if (!sameActor(input.actor, actor)) {
        throw new CoachPassOperationConflictError();
      }
      await finalizeCoachPassPurchaseRecord(transaction, {
        operation: input.operation,
        projection,
      });
      return undefined;
    });
    if (saved.status !== "authorized") return nonAuthorizedResult(saved);
    return Object.freeze({
      status: "finalized",
      operationId: input.operation.operationId,
      operation: input.operation.operation,
      transactionSignature: input.signature,
      failureCode: null,
      finalizedSlot: projection.observedSlot.toString(),
    });
  }

  const evidence = verifiedCoachPassBookingEvidence({
    operation: input.operation,
    state: input.state as CoachPassBookingChainState,
    signature: input.signature,
  });
  if (!evidence) return null;
  const saved = await actorStep(async (transaction, actor) => {
    if (!sameActor(input.actor, actor)) {
      throw new CoachPassOperationConflictError();
    }
    await finalizeCoachPassBookingRecord(transaction, evidence);
    return undefined;
  });
  if (saved.status !== "authorized") return nonAuthorizedResult(saved);
  return Object.freeze({
    status: "finalized",
    operationId: input.operation.operationId,
    operation: input.operation.operation,
    transactionSignature: input.signature,
    failureCode: null,
    finalizedSlot: evidence.observedSlot.toString(),
  });
}

export async function recoverCoachPassOperation(
  operationId: string,
): Promise<CoachPassOperationApiResult> {
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
      throw new CoachPassOperationConflictError();
    }
    const rpc = rpcGateway(config.serverRpcUrl);
    const lastValidBlockHeight = operation.prepared
      ? BigInt(operation.prepared.lastValidBlockHeight)
      : null;
    if (operation.status === "prepared") {
      if (!operation.prepared || !operation.simulation) {
        throw new CoachPassOperationConflictError();
      }
      if ((await rpc.blockHeight("confirmed")) > lastValidBlockHeight!) {
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
    if (!transactionSignature || lastValidBlockHeight === null) {
      throw new CoachPassOperationConflictError();
    }
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
      const state = await readFinalizedState({
        rpc,
        operation,
        minContextSlot: signatureStatus.slot,
      });
      return (
        (await finalizeObservedOperation({
          actor: loaded.actor,
          operation,
          state,
          signature: transactionSignature,
        })) ?? Object.freeze({ status: "conflict" as const })
      );
    }
    if (signatureStatus !== null) return snapshot(operation);
    if ((await rpc.blockHeight("finalized")) <= lastValidBlockHeight) {
      return snapshot(operation);
    }

    const state = await readFinalizedState({ rpc, operation });
    const finalized = await finalizeObservedOperation({
      actor: loaded.actor,
      operation,
      state,
      signature: transactionSignature,
    });
    if (finalized) return finalized;
    return markFailure(
      loaded.actor,
      operation,
      "expired",
      "state-not-observed",
    );
  } catch (error) {
    return mapError(error);
  }
}
