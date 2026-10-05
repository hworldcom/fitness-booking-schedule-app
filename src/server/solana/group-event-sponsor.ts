import "server-only";

import {
  assertIsSendableTransaction,
  getBase64Decoder,
  getPublicKeyFromAddress,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransactionWithSigners,
  verifySignature,
  type Address,
} from "@solana/kit";
import type { FeeSponsor } from "@/solana/fee-sponsor";
import type { GroupEventInvalidReason } from "@/solana/group-event-operation";
import {
  decodeGroupEventTransactionBase64,
  matchesPreparedGroupEventMessage,
  type PreparedGroupEventTransaction,
} from "@/solana/group-event-transaction";

type GroupEventSponsorInvalidReason = Exclude<
  GroupEventInvalidReason,
  "submit-payload-invalid"
>;

export type SponsoredGroupEventTransaction = Readonly<{
  transactionBase64: string;
  transactionSignature: string;
}>;

export class GroupEventSponsorValidationError extends Error {
  readonly code: GroupEventSponsorInvalidReason;

  constructor(code: GroupEventSponsorInvalidReason, message: string) {
    super(message);
    this.name = "GroupEventSponsorValidationError";
    this.code = code;
  }
}

export async function validateAndSponsorGroupEventTransaction(input: {
  prepared: PreparedGroupEventTransaction;
  walletSignedTransactionBase64: string;
  sponsor: FeeSponsor;
}): Promise<SponsoredGroupEventTransaction> {
  if (input.sponsor.address !== input.prepared.summary.platformPayerAddress) {
    throw new GroupEventSponsorValidationError(
      "sponsor-mismatch",
      "Configured platform payer does not match the preparation.",
    );
  }

  let transaction;
  try {
    transaction = getTransactionDecoder().decode(
      decodeGroupEventTransactionBase64(input.walletSignedTransactionBase64),
    );
  } catch {
    throw new GroupEventSponsorValidationError(
      "wallet-transaction-invalid",
      "Wallet returned an invalid Solana transaction.",
    );
  }
  if (
    !matchesPreparedGroupEventMessage({
      signedTransactionMessage: transaction.messageBytes,
      preparedMessageBase64: input.prepared.messageBase64,
    })
  ) {
    throw new GroupEventSponsorValidationError(
      "wallet-message-mismatch",
      "Wallet-signed transaction does not match the preparation.",
    );
  }

  const expectedSigners = new Set<Address>([
    input.prepared.summary.platformPayerAddress,
    input.prepared.summary.authorityAddress,
  ]);
  const actualSigners = Object.keys(transaction.signatures) as Address[];
  if (
    actualSigners.length !== expectedSigners.size ||
    actualSigners.some((signer) => !expectedSigners.has(signer))
  ) {
    throw new GroupEventSponsorValidationError(
      "wallet-signer-set-invalid",
      "Transaction has an unexpected signer set.",
    );
  }
  if (transaction.signatures[input.sponsor.address] !== null) {
    throw new GroupEventSponsorValidationError(
      "wallet-sponsor-pre-signed",
      "Wallet transaction already contains a platform signature.",
    );
  }
  const authoritySignature =
    transaction.signatures[input.prepared.summary.authorityAddress];
  if (!authoritySignature) {
    throw new GroupEventSponsorValidationError(
      "wallet-authority-signature-missing",
      "Required wallet signature is missing.",
    );
  }
  const authorityPublicKey = await getPublicKeyFromAddress(
    input.prepared.summary.authorityAddress,
  );
  if (
    !(await verifySignature(
      authorityPublicKey,
      authoritySignature,
      transaction.messageBytes,
    ))
  ) {
    throw new GroupEventSponsorValidationError(
      "wallet-authority-signature-invalid",
      "Required wallet signature is invalid.",
    );
  }

  const sponsoredTransaction = await partiallySignTransactionWithSigners(
    [input.sponsor.signer],
    transaction,
  );
  assertIsSendableTransaction(sponsoredTransaction);
  return Object.freeze({
    transactionBase64: getBase64Decoder().decode(
      getTransactionEncoder().encode(sponsoredTransaction),
    ),
    transactionSignature: getSignatureFromTransaction(sponsoredTransaction),
  });
}
