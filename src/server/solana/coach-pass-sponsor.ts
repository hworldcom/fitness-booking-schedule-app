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
import {
  decodeCoachPassTransactionBase64,
  matchesPreparedCoachPassMessage,
  type PreparedCoachPassTransaction,
  type PreparedCoachPassBootstrapTransaction,
} from "@/solana/coach-pass-transaction";
import type { FeeSponsor } from "@/solana/fee-sponsor";

export type SponsoredCoachPassTransaction = Readonly<{
  transactionBase64: string;
  transactionSignature: string;
}>;

export async function validateAndSponsorCoachPassTransaction(input: {
  prepared: PreparedCoachPassTransaction;
  walletSignedTransactionBase64: string;
  sponsor: FeeSponsor;
}): Promise<SponsoredCoachPassTransaction> {
  if (input.sponsor.address !== input.prepared.summary.platformPayerAddress) {
    throw new Error(
      "Configured platform payer does not match the preparation.",
    );
  }

  let transaction;
  try {
    transaction = getTransactionDecoder().decode(
      decodeCoachPassTransactionBase64(input.walletSignedTransactionBase64),
    );
  } catch (error) {
    throw new Error("Wallet returned an invalid Solana transaction.", {
      cause: error,
    });
  }
  if (
    !matchesPreparedCoachPassMessage({
      signedTransactionMessage: transaction.messageBytes,
      preparedMessageBase64: input.prepared.messageBase64,
    })
  ) {
    throw new Error(
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
    throw new Error("Transaction has an unexpected signer set.");
  }
  if (transaction.signatures[input.sponsor.address] !== null) {
    throw new Error(
      "Wallet transaction already contains a platform signature.",
    );
  }
  const authoritySignature =
    transaction.signatures[input.prepared.summary.authorityAddress];
  if (!authoritySignature) {
    throw new Error("Required wallet signature is missing.");
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
    throw new Error("Required wallet signature is invalid.");
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

export async function validateAndSponsorCoachPassBootstrapTransaction(input: {
  prepared: PreparedCoachPassBootstrapTransaction;
  walletSignedTransactionBase64: string;
  sponsor: FeeSponsor;
}): Promise<SponsoredCoachPassTransaction> {
  const { prepared, sponsor } = input;
  if (sponsor.address !== prepared.summary.platformPayerAddress) {
    throw new Error(
      "Configured platform payer does not match the preparation.",
    );
  }

  let transaction;
  try {
    transaction = getTransactionDecoder().decode(
      decodeCoachPassTransactionBase64(input.walletSignedTransactionBase64),
    );
  } catch (error) {
    throw new Error("Wallets returned an invalid Solana transaction.", {
      cause: error,
    });
  }
  if (
    !matchesPreparedCoachPassMessage({
      signedTransactionMessage: transaction.messageBytes,
      preparedMessageBase64: prepared.messageBase64,
    })
  ) {
    throw new Error("Wallet-signed bootstrap does not match the preparation.");
  }

  const walletSigners = [
    prepared.summary.coachWalletAddress,
    prepared.summary.recoveryAuthorityAddress,
  ] as const;
  const expectedSigners = new Set<Address>([sponsor.address, ...walletSigners]);
  const actualSigners = Object.keys(transaction.signatures) as Address[];
  if (
    actualSigners.length !== expectedSigners.size ||
    actualSigners.some((signer) => !expectedSigners.has(signer))
  ) {
    throw new Error("Bootstrap transaction has an unexpected signer set.");
  }
  if (transaction.signatures[sponsor.address] !== null) {
    throw new Error(
      "Bootstrap transaction already contains a platform signature.",
    );
  }
  for (const signerAddress of walletSigners) {
    const walletSignature = transaction.signatures[signerAddress];
    if (!walletSignature) {
      throw new Error(
        `Required bootstrap signature is missing: ${signerAddress}`,
      );
    }
    const publicKey = await getPublicKeyFromAddress(signerAddress);
    if (
      !(await verifySignature(
        publicKey,
        walletSignature,
        transaction.messageBytes,
      ))
    ) {
      throw new Error(
        `Required bootstrap signature is invalid: ${signerAddress}`,
      );
    }
  }

  const sponsoredTransaction = await partiallySignTransactionWithSigners(
    [sponsor.signer],
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
