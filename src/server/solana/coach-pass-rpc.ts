import "server-only";

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getMintDecoder,
  getMintSize,
  getTokenDecoder,
  getTokenSize,
  type Mint,
  type Token,
} from "@solana-program/token";
import {
  address,
  createSolanaRpc,
  devnet,
  getBase64Encoder,
  signature,
  type Address,
  type Base64EncodedWireTransaction,
  type BlockhashLifetimeConstraint,
  type ReadonlyUint8Array,
} from "@solana/kit";
import {
  COACH_AUTHORITY_DISCRIMINATOR,
  getCoachAuthorityDecoder,
  type CoachAuthority,
} from "../../../clients/js/src/generated/accounts/coachAuthority";
import {
  COACH_CLIENT_CREDITS_DISCRIMINATOR,
  getCoachClientCreditsDecoder,
  type CoachClientCredits,
} from "../../../clients/js/src/generated/accounts/coachClientCredits";
import {
  CREDIT_RESERVATION_DISCRIMINATOR,
  getCreditReservationDecoder,
  type CreditReservation,
} from "../../../clients/js/src/generated/accounts/creditReservation";
import {
  OFFER_DISCRIMINATOR,
  getOfferDecoder,
  type Offer,
} from "../../../clients/js/src/generated/accounts/offer";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachClientCreditsAddress,
} from "@/solana/coach-pass";
import type { PreparedCoachPassTransaction } from "@/solana/coach-pass-transaction";

const UPGRADEABLE_LOADER_ADDRESS = address(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const COACH_AUTHORITY_ACCOUNT_SIZE = 200;
const OFFER_ACCOUNT_SIZE = 232;
const COACH_CLIENT_CREDITS_ACCOUNT_SIZE = 200;
const CREDIT_RESERVATION_ACCOUNT_SIZE = 200;

export type CoachPassRpcCommitment = "confirmed" | "finalized";

export type CoachPassRawAccount = Readonly<{
  address: Address;
  owner: Address;
  executable: boolean;
  data: Uint8Array;
}>;

export type CoachPassSignatureStatus = Readonly<{
  confirmationStatus: "processed" | "confirmed" | "finalized" | null;
  error: unknown | null;
  slot: bigint;
}> | null;

export type CoachPassSimulationResult = Readonly<{
  slot: bigint;
  unitsConsumed: bigint | null;
}>;

export interface CoachPassRpcGateway {
  accounts(
    addresses: readonly Address[],
    options: Readonly<{
      commitment: CoachPassRpcCommitment;
      minContextSlot?: bigint;
    }>,
  ): Promise<
    Readonly<{ slot: bigint; values: readonly (CoachPassRawAccount | null)[] }>
  >;
  latestBlockhash(
    minContextSlot?: bigint,
  ): Promise<BlockhashLifetimeConstraint>;
  blockHeight(commitment: CoachPassRpcCommitment): Promise<bigint>;
  simulate(
    transactionBase64: string,
    minContextSlot?: bigint,
  ): Promise<CoachPassSimulationResult>;
  send(transactionBase64: string, minContextSlot?: bigint): Promise<string>;
  signatureStatus(
    transactionSignature: string,
  ): Promise<CoachPassSignatureStatus>;
}

export class CoachPassRpcError extends Error {
  readonly code:
    | "account-missing"
    | "account-invalid"
    | "insufficient-eurc"
    | "simulation-failed"
    | "rpc-unavailable";

  constructor(
    code: CoachPassRpcError["code"],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachPassRpcError";
    this.code = code;
  }
}

function compactRpcError(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return "unknown";
  }
}

export function createCoachPassRpcGateway(rpcUrl: string): CoachPassRpcGateway {
  const rpc = createSolanaRpc(devnet(rpcUrl));
  const base64Encoder = getBase64Encoder();

  return Object.freeze({
    async accounts(
      addresses: readonly Address[],
      options: Readonly<{
        commitment: CoachPassRpcCommitment;
        minContextSlot?: bigint;
      }>,
    ) {
      try {
        const response = await rpc
          .getMultipleAccounts(addresses, {
            encoding: "base64",
            commitment: options.commitment,
            ...(options.minContextSlot === undefined
              ? {}
              : { minContextSlot: options.minContextSlot }),
          })
          .send();
        return Object.freeze({
          slot: BigInt(response.context.slot),
          values: Object.freeze(
            response.value.map((value, index) =>
              value === null
                ? null
                : Object.freeze({
                    address: addresses[index]!,
                    owner: value.owner,
                    executable: value.executable,
                    data: new Uint8Array(base64Encoder.encode(value.data[0])),
                  }),
            ),
          ),
        });
      } catch (error) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "Solana account reads are unavailable.",
          { cause: error },
        );
      }
    },

    async latestBlockhash(minContextSlot?: bigint) {
      try {
        const response = await rpc
          .getLatestBlockhash({
            commitment: "confirmed",
            ...(minContextSlot === undefined ? {} : { minContextSlot }),
          })
          .send();
        return response.value;
      } catch (error) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "A recent Solana blockhash is unavailable.",
          { cause: error },
        );
      }
    },

    async blockHeight(commitment: CoachPassRpcCommitment) {
      try {
        return await rpc.getBlockHeight({ commitment }).send();
      } catch (error) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "The Solana block height is unavailable.",
          { cause: error },
        );
      }
    },

    async simulate(transactionBase64: string, minContextSlot?: bigint) {
      try {
        const response = await rpc
          .simulateTransaction(
            transactionBase64 as Base64EncodedWireTransaction,
            {
              encoding: "base64",
              commitment: "confirmed",
              sigVerify: false,
              ...(minContextSlot === undefined ? {} : { minContextSlot }),
            },
          )
          .send();
        if (response.value.err !== null) {
          throw new CoachPassRpcError(
            "simulation-failed",
            `Coach-pass simulation failed: ${compactRpcError(response.value.err)}`,
          );
        }
        return Object.freeze({
          slot: BigInt(response.context.slot),
          unitsConsumed:
            response.value.unitsConsumed == null
              ? null
              : BigInt(response.value.unitsConsumed),
        });
      } catch (error) {
        if (error instanceof CoachPassRpcError) throw error;
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "Coach-pass simulation is unavailable.",
          { cause: error },
        );
      }
    },

    async send(transactionBase64: string, minContextSlot?: bigint) {
      try {
        return await rpc
          .sendTransaction(transactionBase64 as Base64EncodedWireTransaction, {
            encoding: "base64",
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: BigInt(0),
            ...(minContextSlot === undefined ? {} : { minContextSlot }),
          })
          .send();
      } catch (error) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "The transaction outcome is unknown; recover it by signature.",
          { cause: error },
        );
      }
    },

    async signatureStatus(transactionSignature: string) {
      try {
        const response = await rpc
          .getSignatureStatuses([signature(transactionSignature)], {
            searchTransactionHistory: true,
          })
          .send();
        const value = response.value[0];
        return value === null
          ? null
          : Object.freeze({
              confirmationStatus: value.confirmationStatus,
              error: value.err,
              slot: BigInt(value.slot),
            });
      } catch (error) {
        throw new CoachPassRpcError(
          "rpc-unavailable",
          "The transaction status is unavailable.",
          { cause: error },
        );
      }
    },
  });
}

function sameBytes(left: ReadonlyUint8Array, right: ReadonlyUint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function requireAccount(
  value: CoachPassRawAccount | null,
  label: string,
): CoachPassRawAccount {
  if (value === null) {
    throw new CoachPassRpcError(
      "account-missing",
      `${label} is not available on Solana.`,
    );
  }
  return value;
}

function decodeProgramData<T>(input: {
  account: CoachPassRawAccount | null;
  label: string;
  programAddress: Address;
  size: number;
  discriminator: ReadonlyUint8Array;
  decode: (data: Uint8Array) => T;
}) {
  const account = requireAccount(input.account, input.label);
  if (
    account.owner !== input.programAddress ||
    account.executable ||
    account.data.byteLength !== input.size ||
    !sameBytes(account.data.subarray(0, 8), input.discriminator)
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${input.label} failed owner, size or discriminator validation.`,
    );
  }
  try {
    return input.decode(account.data);
  } catch (error) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${input.label} could not be decoded.`,
      { cause: error },
    );
  }
}

export function validateCoachPassProgramAccount(
  account: CoachPassRawAccount | null,
  expectedAddress: Address,
) {
  const value = requireAccount(account, "Coach-pass program");
  if (
    value.address !== expectedAddress ||
    !value.executable ||
    value.owner !== UPGRADEABLE_LOADER_ADDRESS
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      "Coach-pass program identity or loader is invalid.",
    );
  }
}

export function decodeVerifiedCoachAuthority(
  account: CoachPassRawAccount | null,
  programAddress: Address,
): CoachAuthority {
  return decodeProgramData({
    account,
    label: "Coach authority",
    programAddress,
    size: COACH_AUTHORITY_ACCOUNT_SIZE,
    discriminator: COACH_AUTHORITY_DISCRIMINATOR,
    decode: (data) => getCoachAuthorityDecoder().decode(data),
  });
}

export function decodeVerifiedOffer(
  account: CoachPassRawAccount | null,
  programAddress: Address,
): Offer {
  return decodeProgramData({
    account,
    label: "Coach offer",
    programAddress,
    size: OFFER_ACCOUNT_SIZE,
    discriminator: OFFER_DISCRIMINATOR,
    decode: (data) => getOfferDecoder().decode(data),
  });
}

export function decodeVerifiedCoachClientCredits(
  account: CoachPassRawAccount | null,
  programAddress: Address,
): CoachClientCredits {
  return decodeProgramData({
    account,
    label: "Coach-client credit ledger",
    programAddress,
    size: COACH_CLIENT_CREDITS_ACCOUNT_SIZE,
    discriminator: COACH_CLIENT_CREDITS_DISCRIMINATOR,
    decode: (data) => getCoachClientCreditsDecoder().decode(data),
  });
}

export function decodeVerifiedCreditReservation(
  account: CoachPassRawAccount | null,
  programAddress: Address,
): CreditReservation {
  return decodeProgramData({
    account,
    label: "Booking-credit reservation",
    programAddress,
    size: CREDIT_RESERVATION_ACCOUNT_SIZE,
    discriminator: CREDIT_RESERVATION_DISCRIMINATOR,
    decode: (data) => getCreditReservationDecoder().decode(data),
  });
}

export function decodeVerifiedEurcMint(
  account: CoachPassRawAccount | null,
): Mint {
  const value = requireAccount(account, "Devnet EURC mint");
  if (
    value.owner !== TOKEN_PROGRAM_ADDRESS ||
    value.executable ||
    value.data.byteLength !== getMintSize()
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      "Devnet EURC mint failed owner or size validation.",
    );
  }
  const mint = getMintDecoder().decode(value.data);
  if (!mint.isInitialized || mint.decimals !== 6) {
    throw new CoachPassRpcError(
      "account-invalid",
      "Devnet EURC mint has unsupported initialization or decimals.",
    );
  }
  return mint;
}

export function decodeVerifiedEurcTokenAccount(
  account: CoachPassRawAccount | null,
  expectedOwner: Address,
): Token {
  const value = requireAccount(account, "EURC token account");
  if (
    value.owner !== TOKEN_PROGRAM_ADDRESS ||
    value.executable ||
    value.data.byteLength !== getTokenSize()
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      "EURC token account failed owner or size validation.",
    );
  }
  const token = getTokenDecoder().decode(value.data);
  if (
    token.owner !== expectedOwner ||
    token.mint !== DEVNET_EURC_MINT_ADDRESS
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      "EURC token account has an unexpected owner or mint.",
    );
  }
  return token;
}

export type CoachPassPurchaseChainState = Readonly<{
  slot: bigint;
  coachAuthority: CoachAuthority;
  offer: Offer;
  coachClientCredits: CoachClientCredits | null;
  clientEurcAccount: Token;
  clientTokenAccountAddress: Address;
  coachTokenAccountAddress: Address;
}>;

export async function readCoachPassPurchaseState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  coachAuthorityAddress: Address;
  offerAddress: Address;
  clientWalletAddress: Address;
  requireSufficientClientBalance?: boolean;
  minContextSlot?: bigint;
}): Promise<CoachPassPurchaseChainState> {
  const [coachClientCreditsAddress] = await deriveCoachClientCreditsAddress({
    programAddress: input.programAddress,
    coachAuthority: input.coachAuthorityAddress,
    clientWallet: input.clientWalletAddress,
  });
  const [clientTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.clientWalletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const firstRead = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.coachAuthorityAddress,
      input.offerAddress,
      coachClientCreditsAddress,
      clientTokenAccountAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  validateCoachPassProgramAccount(firstRead.values[0]!, input.programAddress);
  decodeVerifiedEurcMint(firstRead.values[1]!);
  const coachAuthority = decodeVerifiedCoachAuthority(
    firstRead.values[2]!,
    input.programAddress,
  );
  const offer = decodeVerifiedOffer(firstRead.values[3]!, input.programAddress);
  const coachClientCredits = firstRead.values[4]
    ? decodeVerifiedCoachClientCredits(
        firstRead.values[4],
        input.programAddress,
      )
    : null;
  const clientEurcAccount = decodeVerifiedEurcTokenAccount(
    firstRead.values[5]!,
    input.clientWalletAddress,
  );
  if (
    input.requireSufficientClientBalance !== false &&
    clientEurcAccount.amount < offer.priceEurcBaseUnits
  ) {
    throw new CoachPassRpcError(
      "insufficient-eurc",
      "The linked client wallet has insufficient test EURC.",
    );
  }

  const [coachTokenAccountAddress] = await findAssociatedTokenPda({
    owner: offer.paymentRecipient,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const coachRead = await input.rpc.accounts([coachTokenAccountAddress], {
    commitment: input.commitment,
    minContextSlot: firstRead.slot,
  });
  if (coachRead.values[0]) {
    decodeVerifiedEurcTokenAccount(coachRead.values[0], offer.paymentRecipient);
  }

  return Object.freeze({
    slot: coachRead.slot,
    coachAuthority,
    offer,
    coachClientCredits,
    clientEurcAccount,
    clientTokenAccountAddress,
    coachTokenAccountAddress,
  });
}

export type CoachPassBookingChainState = Readonly<{
  slot: bigint;
  coachAuthority: CoachAuthority;
  coachClientCredits: CoachClientCredits;
  creditReservation: CreditReservation | null;
}>;

export async function readCoachPassBookingState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  coachAuthorityAddress: Address;
  coachClientCreditsAddress: Address;
  creditReservationAddress: Address;
  minContextSlot?: bigint;
}): Promise<CoachPassBookingChainState> {
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      input.coachAuthorityAddress,
      input.coachClientCreditsAddress,
      input.creditReservationAddress,
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
    coachAuthority: decodeVerifiedCoachAuthority(
      read.values[1]!,
      input.programAddress,
    ),
    coachClientCredits: decodeVerifiedCoachClientCredits(
      read.values[2]!,
      input.programAddress,
    ),
    creditReservation: read.values[3]
      ? decodeVerifiedCreditReservation(read.values[3], input.programAddress)
      : null,
  });
}

export async function simulatePreparedCoachPassTransaction(input: {
  rpc: CoachPassRpcGateway;
  prepared: PreparedCoachPassTransaction;
  minContextSlot?: bigint;
}) {
  return input.rpc.simulate(
    input.prepared.transactionBase64,
    input.minContextSlot,
  );
}
