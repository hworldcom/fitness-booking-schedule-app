import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64Decoder,
  getBase64Encoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type BlockhashLifetimeConstraint,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import type { CoachAuthority } from "../../clients/js/src/generated/accounts/coachAuthority";
import type { CoachClientCredits } from "../../clients/js/src/generated/accounts/coachClientCredits";
import type { CreditReservation } from "../../clients/js/src/generated/accounts/creditReservation";
import type { Offer } from "../../clients/js/src/generated/accounts/offer";
import { getConsumeBookingCreditInstruction } from "../../clients/js/src/generated/instructions/consumeBookingCredit";
import { getCreateOfferInstruction } from "../../clients/js/src/generated/instructions/createOffer";
import { getInitializeCoachAuthorityInstructionAsync } from "../../clients/js/src/generated/instructions/initializeCoachAuthority";
import { getPurchaseFirstOfferInstruction } from "../../clients/js/src/generated/instructions/purchaseFirstOffer";
import { getPurchaseOfferInstruction } from "../../clients/js/src/generated/instructions/purchaseOffer";
import { getReserveBookingCreditInstruction } from "../../clients/js/src/generated/instructions/reserveBookingCredit";
import { getReturnBookingCreditInstruction } from "../../clients/js/src/generated/instructions/returnBookingCredit";
import { CreditReservationStatus } from "../../clients/js/src/generated/types/creditReservationStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveCreditReservationAddress,
  deriveEventAuthorityAddress,
  deriveOfferAddress,
  isOfferPurchaseEligible,
  projectCoachClientCreditSummary,
  projectCreditReservationSummary,
  seedToUuid,
  uuidToSeed,
} from "./coach-pass";

export const COACH_PASS_CLUSTER = "devnet" as const;
export const EURC_DECIMALS = 6;

export type CoachPassOperationKind =
  | "purchase-first-offer"
  | "purchase-offer"
  | "reserve-booking-credit"
  | "return-booking-credit"
  | "consume-booking-credit";

type CoachPassApprovalSummaryBase = Readonly<{
  cluster: typeof COACH_PASS_CLUSTER;
  operation: CoachPassOperationKind;
  programAddress: Address;
  authorityAddress: Address;
  platformPayerAddress: Address;
  coachAuthorityAddress: Address;
  coachClientCreditsAddress: Address;
  creditReservationAddress: Address | null;
  testAsset: "EURC";
  paymentMintAddress: Address;
  userPaysSol: false;
}>;

export type CoachPassPurchaseApprovalSummary = CoachPassApprovalSummaryBase &
  Readonly<{
    operation: "purchase-first-offer" | "purchase-offer";
    offerAddress: Address;
    paymentRecipientAddress: Address;
    priceEurcBaseUnits: string;
    creditsPurchased: 1 | 10;
    expectedPurchaseNonce: string;
    clientTokenAccountAddress: Address;
    coachTokenAccountAddress: Address;
  }>;

export type CoachPassBookingApprovalSummary = CoachPassApprovalSummaryBase &
  Readonly<{
    operation:
      | "reserve-booking-credit"
      | "return-booking-credit"
      | "consume-booking-credit";
    bookingId: string;
    clientWalletAddress: Address;
    scheduledStartUnixSeconds: string;
    earlyReturnUntilUnixSeconds: string;
  }>;

export type CoachPassApprovalSummary =
  CoachPassPurchaseApprovalSummary | CoachPassBookingApprovalSummary;

export type CoachPassBootstrapApprovalSummary = Readonly<{
  cluster: typeof COACH_PASS_CLUSTER;
  operation: "initialize-coach-and-offers";
  programAddress: Address;
  coachWalletAddress: Address;
  recoveryAuthorityAddress: Address;
  platformPayerAddress: Address;
  coachAuthorityAddress: Address;
  oneCreditOfferAddress: Address;
  tenCreditOfferAddress: Address;
  oneCreditPriceEurcBaseUnits: string;
  tenCreditPriceEurcBaseUnits: string;
  testAsset: "EURC";
  paymentMintAddress: Address;
  userPaysSol: false;
  eurcMovedBaseUnits: "0";
}>;

type PreparedTransaction<TSummary> = Readonly<{
  summary: TSummary;
  transactionBase64: string;
  messageBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: string;
}>;

export type PreparedCoachPassTransaction =
  PreparedTransaction<CoachPassApprovalSummary>;

export type PreparedCoachPassBootstrapTransaction =
  PreparedTransaction<CoachPassBootstrapApprovalSummary>;

type CommonPreparationInput = Readonly<{
  programAddress: Address;
  platformPayerAddress: Address;
  lifetimeConstraint: BlockhashLifetimeConstraint;
}>;

export type PrepareCoachPassBootstrapInput = CommonPreparationInput &
  Readonly<{
    runId: string;
    profileId: string;
    coachWalletAddress: Address;
    recoveryAuthorityAddress: Address;
    oneCreditPriceEurcBaseUnits: bigint;
    tenCreditPriceEurcBaseUnits: bigint;
  }>;

export type PrepareCoachPassPurchaseInput = CommonPreparationInput &
  Readonly<{
    clientWalletAddress: Address;
    coachAuthorityAddress: Address;
    coachAuthority: CoachAuthority;
    offerAddress: Address;
    offer: Offer;
    coachClientCredits: CoachClientCredits | null;
    currentUnixSeconds: bigint;
  }>;

export type PrepareCoachPassReservationInput = CommonPreparationInput &
  Readonly<{
    clientWalletAddress: Address;
    coachAuthorityAddress: Address;
    coachAuthority: CoachAuthority;
    coachClientCreditsAddress: Address;
    coachClientCredits: CoachClientCredits;
    bookingId: string;
    scheduledStartUnixSeconds: bigint;
    earlyReturnUntilUnixSeconds: bigint;
  }>;

export type PrepareCoachPassResolutionInput = CommonPreparationInput &
  Readonly<{
    resolution: "return" | "consume";
    authorityAddress: Address;
    coachAuthorityAddress: Address;
    coachAuthority: CoachAuthority;
    coachClientCreditsAddress: Address;
    coachClientCredits: CoachClientCredits;
    creditReservationAddress: Address;
    creditReservation: CreditReservation;
    currentUnixSeconds: bigint;
  }>;

function sameBytes(left: ReadonlyUint8Array, right: ReadonlyUint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function assertCoachAuthority(input: {
  programAddress: Address;
  coachAuthorityAddress: Address;
  coachAuthority: CoachAuthority;
}) {
  return deriveCoachAuthorityAddress({
    programAddress: input.programAddress,
    runId: seedToUuid(input.coachAuthority.runId),
    profileId: seedToUuid(input.coachAuthority.profileId),
    originalWallet: input.coachAuthority.originalWallet,
  }).then(([derivedAddress, derivedBump]) => {
    if (
      derivedAddress !== input.coachAuthorityAddress ||
      derivedBump !== input.coachAuthority.bump
    ) {
      throw new Error(
        "Coach authority address does not match its on-chain seeds.",
      );
    }
  });
}

function compilePreparedTransaction<
  TSummary extends CoachPassApprovalSummary | CoachPassBootstrapApprovalSummary,
>(input: {
  summary: TSummary;
  instructions: readonly Instruction[];
  platformPayerAddress: Address;
  lifetimeConstraint: BlockhashLifetimeConstraint;
}): PreparedTransaction<TSummary> {
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (current) =>
      setTransactionMessageFeePayer(input.platformPayerAddress, current),
    (current) =>
      setTransactionMessageLifetimeUsingBlockhash(
        input.lifetimeConstraint,
        current,
      ),
    (current) =>
      appendTransactionMessageInstructions(input.instructions, current),
  );
  const transaction = compileTransaction(message);
  const transactionBytes = getTransactionEncoder().encode(transaction);
  const base64Decoder = getBase64Decoder();

  return Object.freeze({
    summary: Object.freeze(input.summary),
    transactionBase64: base64Decoder.decode(transactionBytes),
    messageBase64: base64Decoder.decode(transaction.messageBytes),
    recentBlockhash: input.lifetimeConstraint.blockhash,
    lastValidBlockHeight:
      input.lifetimeConstraint.lastValidBlockHeight.toString(),
  });
}

export async function prepareCoachPassBootstrap(
  input: PrepareCoachPassBootstrapInput,
): Promise<PreparedCoachPassBootstrapTransaction> {
  if (
    input.coachWalletAddress === input.recoveryAuthorityAddress ||
    input.coachWalletAddress === input.platformPayerAddress ||
    input.recoveryAuthorityAddress === input.platformPayerAddress
  ) {
    throw new Error(
      "Coach, recovery authority and platform payer must be distinct.",
    );
  }
  if (
    input.oneCreditPriceEurcBaseUnits <= BigInt(0) ||
    input.tenCreditPriceEurcBaseUnits !==
      input.oneCreditPriceEurcBaseUnits * BigInt(10)
  ) {
    throw new Error(
      "Bootstrap offers must price one and ten credits consistently.",
    );
  }

  const [coachAuthorityAddress] = await deriveCoachAuthorityAddress({
    programAddress: input.programAddress,
    runId: input.runId,
    profileId: input.profileId,
    originalWallet: input.coachWalletAddress,
  });
  const [oneCreditOfferAddress] = await deriveOfferAddress({
    programAddress: input.programAddress,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(0),
  });
  const [tenCreditOfferAddress] = await deriveOfferAddress({
    programAddress: input.programAddress,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(1),
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const coachWallet = createNoopSigner(input.coachWalletAddress);
  const recoveryAuthority = createNoopSigner(input.recoveryAuthorityAddress);
  const platformPayer = createNoopSigner(input.platformPayerAddress);
  const instructions: Instruction[] = [
    await getInitializeCoachAuthorityInstructionAsync(
      {
        coachWallet,
        recoveryAuthority,
        platformPayer,
        coachAuthority: coachAuthorityAddress,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
        runId: [...uuidToSeed(input.runId)],
        profileId: [...uuidToSeed(input.profileId)],
      },
      { programAddress: input.programAddress },
    ),
    getCreateOfferInstruction(
      {
        coachWallet,
        platformPayer,
        coachAuthority: coachAuthorityAddress,
        offer: oneCreditOfferAddress,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
        args: {
          nonce: BigInt(0),
          priceEurcBaseUnits: input.oneCreditPriceEurcBaseUnits,
          sessionCount: 1,
          validitySeconds: 0,
          restrictedClient: null,
        },
      },
      { programAddress: input.programAddress },
    ),
    getCreateOfferInstruction(
      {
        coachWallet,
        platformPayer,
        coachAuthority: coachAuthorityAddress,
        offer: tenCreditOfferAddress,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
        args: {
          nonce: BigInt(1),
          priceEurcBaseUnits: input.tenCreditPriceEurcBaseUnits,
          sessionCount: 10,
          validitySeconds: 0,
          restrictedClient: null,
        },
      },
      { programAddress: input.programAddress },
    ),
  ];

  return compilePreparedTransaction({
    summary: {
      cluster: COACH_PASS_CLUSTER,
      operation: "initialize-coach-and-offers",
      programAddress: input.programAddress,
      coachWalletAddress: input.coachWalletAddress,
      recoveryAuthorityAddress: input.recoveryAuthorityAddress,
      platformPayerAddress: input.platformPayerAddress,
      coachAuthorityAddress,
      oneCreditOfferAddress,
      tenCreditOfferAddress,
      oneCreditPriceEurcBaseUnits: input.oneCreditPriceEurcBaseUnits.toString(),
      tenCreditPriceEurcBaseUnits: input.tenCreditPriceEurcBaseUnits.toString(),
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      eurcMovedBaseUnits: "0",
    },
    instructions,
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

function assertCreditLedger(input: {
  credits: CoachClientCredits;
  coachAuthorityAddress: Address;
  clientWalletAddress: Address;
}) {
  return projectCoachClientCreditSummary({
    credits: input.credits,
    expectedCoachAuthority: input.coachAuthorityAddress,
    expectedClientWallet: input.clientWalletAddress,
  });
}

export async function prepareCoachPassPurchase(
  input: PrepareCoachPassPurchaseInput,
): Promise<PreparedCoachPassTransaction> {
  await assertCoachAuthority(input);
  const [expectedOfferAddress, expectedOfferBump] = await deriveOfferAddress({
    programAddress: input.programAddress,
    coachAuthority: input.coachAuthorityAddress,
    nonce: input.offer.nonce,
  });
  if (
    expectedOfferAddress !== input.offerAddress ||
    expectedOfferBump !== input.offer.bump
  ) {
    throw new Error("Offer address does not match its on-chain seeds.");
  }
  if (
    !isOfferPurchaseEligible({
      offer: input.offer,
      offerCoachAuthorityAddress: input.coachAuthorityAddress,
      authority: input.coachAuthority,
      clientWallet: input.clientWalletAddress,
      purchasedAtUnixSeconds: input.currentUnixSeconds,
    })
  ) {
    throw new Error("Offer is not eligible for this client purchase.");
  }
  if (
    input.offer.priceEurcBaseUnits <= BigInt(0) ||
    (input.offer.sessionCount !== 1 && input.offer.sessionCount !== 10)
  ) {
    throw new Error("Offer has unsupported purchase terms.");
  }

  const [coachClientCreditsAddress, coachClientCreditsBump] =
    await deriveCoachClientCreditsAddress({
      programAddress: input.programAddress,
      coachAuthority: input.coachAuthorityAddress,
      clientWallet: input.clientWalletAddress,
    });
  const [clientTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.clientWalletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [coachTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.offer.paymentRecipient,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const clientSigner = createNoopSigner(input.clientWalletAddress);
  const platformPayerSigner = createNoopSigner(input.platformPayerAddress);
  const instructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: platformPayerSigner,
      ata: coachTokenAccountAddress,
      owner: input.offer.paymentRecipient,
      mint: DEVNET_EURC_MINT_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
  ];

  const firstPurchase = input.coachClientCredits === null;
  let expectedPurchaseNonce = BigInt(0);
  if (firstPurchase) {
    instructions.push(
      getPurchaseFirstOfferInstruction(
        {
          clientWallet: clientSigner,
          platformPayer: platformPayerSigner,
          coachAuthority: input.coachAuthorityAddress,
          offer: input.offerAddress,
          coachClientCredits: coachClientCreditsAddress,
          paymentMint: DEVNET_EURC_MINT_ADDRESS,
          clientTokenAccount: clientTokenAccountAddress,
          coachTokenAccount: coachTokenAccountAddress,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          eventAuthority: eventAuthorityAddress,
          program: input.programAddress,
        },
        { programAddress: input.programAddress },
      ),
    );
  } else {
    const credits = assertCreditLedger({
      credits: input.coachClientCredits,
      coachAuthorityAddress: input.coachAuthorityAddress,
      clientWalletAddress: input.clientWalletAddress,
    });
    if (input.coachClientCredits.bump !== coachClientCreditsBump) {
      throw new Error(
        "Credit ledger address does not match its on-chain seeds.",
      );
    }
    expectedPurchaseNonce = credits.nextPurchaseNonce;
    instructions.push(
      getPurchaseOfferInstruction(
        {
          clientWallet: clientSigner,
          coachAuthority: input.coachAuthorityAddress,
          offer: input.offerAddress,
          coachClientCredits: coachClientCreditsAddress,
          paymentMint: DEVNET_EURC_MINT_ADDRESS,
          clientTokenAccount: clientTokenAccountAddress,
          coachTokenAccount: coachTokenAccountAddress,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          eventAuthority: eventAuthorityAddress,
          program: input.programAddress,
          expectedPurchaseNonce,
        },
        { programAddress: input.programAddress },
      ),
    );
  }

  return compilePreparedTransaction({
    summary: {
      cluster: COACH_PASS_CLUSTER,
      operation: firstPurchase ? "purchase-first-offer" : "purchase-offer",
      programAddress: input.programAddress,
      authorityAddress: input.clientWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      coachAuthorityAddress: input.coachAuthorityAddress,
      coachClientCreditsAddress,
      creditReservationAddress: null,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      offerAddress: input.offerAddress,
      paymentRecipientAddress: input.offer.paymentRecipient,
      priceEurcBaseUnits: input.offer.priceEurcBaseUnits.toString(),
      creditsPurchased: input.offer.sessionCount,
      expectedPurchaseNonce: expectedPurchaseNonce.toString(),
      clientTokenAccountAddress,
      coachTokenAccountAddress,
    },
    instructions,
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareCoachPassReservation(
  input: PrepareCoachPassReservationInput,
): Promise<PreparedCoachPassTransaction> {
  await assertCoachAuthority(input);
  assertCreditLedger({
    credits: input.coachClientCredits,
    coachAuthorityAddress: input.coachAuthorityAddress,
    clientWalletAddress: input.clientWalletAddress,
  });
  if (input.coachClientCredits.availableCredits < BigInt(1)) {
    throw new Error("No available coach credit can be reserved.");
  }
  if (
    input.scheduledStartUnixSeconds <= BigInt(0) ||
    input.earlyReturnUntilUnixSeconds > input.scheduledStartUnixSeconds
  ) {
    throw new Error("Booking schedule or early-return cutoff is invalid.");
  }
  const [expectedCreditsAddress, expectedCreditsBump] =
    await deriveCoachClientCreditsAddress({
      programAddress: input.programAddress,
      coachAuthority: input.coachAuthorityAddress,
      clientWallet: input.clientWalletAddress,
    });
  if (
    expectedCreditsAddress !== input.coachClientCreditsAddress ||
    expectedCreditsBump !== input.coachClientCredits.bump
  ) {
    throw new Error("Credit ledger address does not match its on-chain seeds.");
  }
  const [creditReservationAddress] = await deriveCreditReservationAddress({
    programAddress: input.programAddress,
    coachClientCredits: input.coachClientCreditsAddress,
    bookingId: input.bookingId,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const instruction = getReserveBookingCreditInstruction(
    {
      clientWallet: createNoopSigner(input.clientWalletAddress),
      platformPayer: createNoopSigner(input.platformPayerAddress),
      coachAuthority: input.coachAuthorityAddress,
      coachClientCredits: input.coachClientCreditsAddress,
      creditReservation: creditReservationAddress,
      eventAuthority: eventAuthorityAddress,
      program: input.programAddress,
      bookingId: [...uuidToSeed(input.bookingId)],
      scheduledStartAt: input.scheduledStartUnixSeconds,
      earlyReturnUntil: input.earlyReturnUntilUnixSeconds,
    },
    { programAddress: input.programAddress },
  );

  return compilePreparedTransaction({
    summary: {
      cluster: COACH_PASS_CLUSTER,
      operation: "reserve-booking-credit",
      programAddress: input.programAddress,
      authorityAddress: input.clientWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      coachAuthorityAddress: input.coachAuthorityAddress,
      coachClientCreditsAddress: input.coachClientCreditsAddress,
      creditReservationAddress,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      bookingId: input.bookingId,
      clientWalletAddress: input.clientWalletAddress,
      scheduledStartUnixSeconds: input.scheduledStartUnixSeconds.toString(),
      earlyReturnUntilUnixSeconds: input.earlyReturnUntilUnixSeconds.toString(),
    },
    instructions: [instruction],
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareCoachPassResolution(
  input: PrepareCoachPassResolutionInput,
): Promise<PreparedCoachPassTransaction> {
  await assertCoachAuthority(input);
  const credits = assertCreditLedger({
    credits: input.coachClientCredits,
    coachAuthorityAddress: input.coachAuthorityAddress,
    clientWalletAddress: input.coachClientCredits.clientWallet,
  });
  if (credits.reservedCredits < BigInt(1)) {
    throw new Error("Credit ledger has no reserved credit to resolve.");
  }
  const bookingId = seedToUuid(input.creditReservation.bookingId);
  const reservation = projectCreditReservationSummary({
    reservation: input.creditReservation,
    expectedCoachClientCredits: input.coachClientCreditsAddress,
    expectedCoachAuthority: input.coachAuthorityAddress,
    expectedClientWallet: input.coachClientCredits.clientWallet,
    expectedBookingId: bookingId,
  });
  if (reservation.status !== CreditReservationStatus.Reserved) {
    throw new Error("Booking credit reservation is already resolved.");
  }
  const [expectedCreditsAddress, expectedCreditsBump] =
    await deriveCoachClientCreditsAddress({
      programAddress: input.programAddress,
      coachAuthority: input.coachAuthorityAddress,
      clientWallet: input.coachClientCredits.clientWallet,
    });
  if (
    expectedCreditsAddress !== input.coachClientCreditsAddress ||
    expectedCreditsBump !== input.coachClientCredits.bump
  ) {
    throw new Error("Credit ledger address does not match its on-chain seeds.");
  }
  const [expectedReservationAddress, expectedReservationBump] =
    await deriveCreditReservationAddress({
      programAddress: input.programAddress,
      coachClientCredits: input.coachClientCreditsAddress,
      bookingId,
    });
  if (
    expectedReservationAddress !== input.creditReservationAddress ||
    expectedReservationBump !== input.creditReservation.bump
  ) {
    throw new Error("Reservation address does not match its on-chain seeds.");
  }
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });

  let instruction: Instruction;
  let operation: CoachPassBookingApprovalSummary["operation"];
  if (input.resolution === "return") {
    const isClient = input.authorityAddress === reservation.clientWallet;
    const isCoach =
      input.authorityAddress === input.coachAuthority.currentWallet;
    if (
      (!isClient && !isCoach) ||
      (isClient && input.currentUnixSeconds > reservation.earlyReturnUntil)
    ) {
      throw new Error("Wallet is not authorized to return this credit now.");
    }
    operation = "return-booking-credit";
    instruction = getReturnBookingCreditInstruction(
      {
        resolutionAuthority: createNoopSigner(input.authorityAddress),
        coachAuthority: input.coachAuthorityAddress,
        coachClientCredits: input.coachClientCreditsAddress,
        creditReservation: input.creditReservationAddress,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
      },
      { programAddress: input.programAddress },
    );
  } else {
    if (
      input.authorityAddress !== input.coachAuthority.currentWallet ||
      input.currentUnixSeconds < reservation.scheduledStartAt
    ) {
      throw new Error("Coach wallet cannot consume this credit yet.");
    }
    operation = "consume-booking-credit";
    instruction = getConsumeBookingCreditInstruction(
      {
        coachWallet: createNoopSigner(input.authorityAddress),
        coachAuthority: input.coachAuthorityAddress,
        coachClientCredits: input.coachClientCreditsAddress,
        creditReservation: input.creditReservationAddress,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
      },
      { programAddress: input.programAddress },
    );
  }

  return compilePreparedTransaction({
    summary: {
      cluster: COACH_PASS_CLUSTER,
      operation,
      programAddress: input.programAddress,
      authorityAddress: input.authorityAddress,
      platformPayerAddress: input.platformPayerAddress,
      coachAuthorityAddress: input.coachAuthorityAddress,
      coachClientCreditsAddress: input.coachClientCreditsAddress,
      creditReservationAddress: input.creditReservationAddress,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      bookingId,
      clientWalletAddress: input.coachClientCredits.clientWallet,
      scheduledStartUnixSeconds: reservation.scheduledStartAt.toString(),
      earlyReturnUntilUnixSeconds: reservation.earlyReturnUntil.toString(),
    },
    instructions: [instruction],
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export function decodeCoachPassTransactionBase64(value: string) {
  return new Uint8Array(getBase64Encoder().encode(value));
}

export function matchesPreparedCoachPassMessage(input: {
  signedTransactionMessage: ReadonlyUint8Array;
  preparedMessageBase64: string;
}) {
  return sameBytes(
    input.signedTransactionMessage,
    new Uint8Array(getBase64Encoder().encode(input.preparedMessageBase64)),
  );
}
