import type { MembershipPaymentQuote } from "./membership-payment";

export type VerifiedMembershipPaymentEvidence = Readonly<{
  signature: string;
  slot: string;
  sourceTokenAddress: string;
}>;

export type MembershipPaymentTransactionValidation =
  | Readonly<{
      status: "verified";
      evidence: VerifiedMembershipPaymentEvidence;
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | "unsupported-version"
        | "execution-failed"
        | "signature-mismatch"
        | "wallet-not-signer"
        | "reference-mismatch"
        | "transfer-shape-mismatch"
        | "balance-mismatch";
    }>;

type ValidationInput = Readonly<{
  quote: MembershipPaymentQuote;
  signature: string;
  expectedSourceTokenAddress: string;
  transaction: unknown;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function integer(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return null;
}

function unsignedIntegerString(value: unknown) {
  if (typeof value === "bigint" && value >= BigInt(0)) return value.toString();
  return typeof value === "string" && /^[0-9]+$/.test(value) ? value : null;
}

function exactTextArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const values: string[] = [];
  for (const candidate of value) {
    const parsed = text(candidate);
    if (!parsed) return null;
    values.push(parsed);
  }
  return values;
}

function transferAuthorityMatches(
  info: Record<string, unknown>,
  walletAddress: string,
  referenceAddress: string,
) {
  if ("authority" in info) {
    return (
      text(info.authority) === walletAddress &&
      !("multisigAuthority" in info) &&
      !("signers" in info)
    );
  }

  // jsonParsed assigns trailing transferChecked accounts to its multisig
  // fields even when our appended reference is read-only and did not sign.
  // The transaction account metadata is checked independently below.
  const parsedSigners = exactTextArray(info.signers);
  return (
    text(info.multisigAuthority) === walletAddress &&
    parsedSigners?.length === 1 &&
    parsedSigners[0] === referenceAddress
  );
}

type ParsedAccount = Readonly<{
  pubkey: string;
  signer: boolean;
  writable: boolean;
}>;

function parsedAccounts(value: unknown): readonly ParsedAccount[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const accounts: ParsedAccount[] = [];
  for (const candidate of value) {
    const item = record(candidate);
    const pubkey = text(item?.pubkey);
    if (
      !item ||
      !pubkey ||
      typeof item.signer !== "boolean" ||
      typeof item.writable !== "boolean"
    ) {
      return null;
    }
    accounts.push({ pubkey, signer: item.signer, writable: item.writable });
  }
  return accounts;
}

type TokenBalance = Readonly<{
  accountIndex: number;
  mint: string;
  owner: string | null;
  programId: string | null;
  amount: bigint;
  decimals: number;
}>;

function tokenBalances(value: unknown): readonly TokenBalance[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const balances: TokenBalance[] = [];
  for (const candidate of value) {
    const item = record(candidate);
    const tokenAmount = record(item?.uiTokenAmount);
    const accountIndex = integer(item?.accountIndex);
    const mint = text(item?.mint);
    const amount = unsignedIntegerString(tokenAmount?.amount);
    const decimals = integer(tokenAmount?.decimals);
    if (
      !item ||
      accountIndex === null ||
      !mint ||
      amount === null ||
      decimals === null
    ) {
      return null;
    }
    balances.push({
      accountIndex,
      mint,
      owner: text(item.owner),
      programId: text(item.programId),
      amount: BigInt(amount),
      decimals,
    });
  }
  return balances;
}

function balanceFor(
  balances: readonly TokenBalance[],
  accountIndex: number,
  mint: string,
) {
  const matches = balances.filter(
    (balance) => balance.accountIndex === accountIndex && balance.mint === mint,
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function validateMembershipPaymentTransaction(
  input: ValidationInput,
): MembershipPaymentTransactionValidation {
  const root = record(input.transaction);
  const transaction = record(root?.transaction);
  const message = record(transaction?.message);
  const meta = record(root?.meta);
  if (!root || !transaction || !message || !meta) {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }
  if (root.version !== "legacy") {
    return { status: "rejected", reason: "unsupported-version" };
  }
  if (meta.err !== null) {
    return { status: "rejected", reason: "execution-failed" };
  }
  const signatures = transaction.signatures;
  if (
    !Array.isArray(signatures) ||
    signatures.length < 1 ||
    signatures[0] !== input.signature
  ) {
    return { status: "rejected", reason: "signature-mismatch" };
  }

  const accounts = parsedAccounts(message.accountKeys);
  if (!accounts) {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }
  const wallet = accounts.find(
    (account) => account.pubkey === input.quote.walletAddress,
  );
  if (!wallet?.signer) {
    return { status: "rejected", reason: "wallet-not-signer" };
  }
  const reference = accounts.find(
    (account) => account.pubkey === input.quote.referenceAddress,
  );
  if (!reference || reference.signer || reference.writable) {
    return { status: "rejected", reason: "reference-mismatch" };
  }

  const instructions = message.instructions;
  if (!Array.isArray(instructions) || instructions.length > 8) {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }
  const transfers = instructions.filter((candidate) => {
    const instruction = record(candidate);
    const parsed = record(instruction?.parsed);
    return (
      instruction?.programId === input.quote.tokenProgramAddress &&
      parsed?.type === "transferChecked"
    );
  });
  if (transfers.length !== 1) {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }
  const transfer = record(transfers[0]);
  const parsed = record(transfer?.parsed);
  const info = record(parsed?.info);
  const tokenAmount = record(info?.tokenAmount);
  if (
    text(info?.source) !== input.expectedSourceTokenAddress ||
    text(info?.mint) !== input.quote.mintAddress ||
    text(info?.destination) !== input.quote.destinationTokenAddress ||
    !transferAuthorityMatches(
      info ?? {},
      input.quote.walletAddress,
      input.quote.referenceAddress,
    ) ||
    unsignedIntegerString(tokenAmount?.amount) !==
      input.quote.amountBaseUnits ||
    integer(tokenAmount?.decimals) !== input.quote.tokenDecimals
  ) {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }

  const sourceIndex = accounts.findIndex(
    (account) => account.pubkey === input.expectedSourceTokenAddress,
  );
  const destinationIndex = accounts.findIndex(
    (account) => account.pubkey === input.quote.destinationTokenAddress,
  );
  const preBalances = tokenBalances(meta.preTokenBalances);
  const postBalances = tokenBalances(meta.postTokenBalances);
  if (
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    !preBalances ||
    !postBalances
  ) {
    return { status: "rejected", reason: "balance-mismatch" };
  }
  const sourceBefore = balanceFor(
    preBalances,
    sourceIndex,
    input.quote.mintAddress,
  );
  const sourceAfter = balanceFor(
    postBalances,
    sourceIndex,
    input.quote.mintAddress,
  );
  const destinationBefore = balanceFor(
    preBalances,
    destinationIndex,
    input.quote.mintAddress,
  );
  const destinationAfter = balanceFor(
    postBalances,
    destinationIndex,
    input.quote.mintAddress,
  );
  const expectedAmount = BigInt(input.quote.amountBaseUnits);
  if (
    !sourceBefore ||
    !sourceAfter ||
    !destinationBefore ||
    !destinationAfter ||
    sourceBefore.owner !== input.quote.walletAddress ||
    sourceAfter.owner !== input.quote.walletAddress ||
    destinationBefore.owner !== input.quote.destinationOwnerAddress ||
    destinationAfter.owner !== input.quote.destinationOwnerAddress ||
    (sourceBefore.programId !== null &&
      sourceBefore.programId !== input.quote.tokenProgramAddress) ||
    (sourceAfter.programId !== null &&
      sourceAfter.programId !== input.quote.tokenProgramAddress) ||
    (destinationBefore.programId !== null &&
      destinationBefore.programId !== input.quote.tokenProgramAddress) ||
    (destinationAfter.programId !== null &&
      destinationAfter.programId !== input.quote.tokenProgramAddress) ||
    sourceBefore.decimals !== input.quote.tokenDecimals ||
    sourceAfter.decimals !== input.quote.tokenDecimals ||
    destinationBefore.decimals !== input.quote.tokenDecimals ||
    destinationAfter.decimals !== input.quote.tokenDecimals ||
    sourceBefore.amount - sourceAfter.amount !== expectedAmount ||
    destinationAfter.amount - destinationBefore.amount !== expectedAmount
  ) {
    return { status: "rejected", reason: "balance-mismatch" };
  }

  const slot = unsignedIntegerString(root.slot);
  if (!slot || slot === "0") {
    return { status: "rejected", reason: "transfer-shape-mismatch" };
  }
  return {
    status: "verified",
    evidence: Object.freeze({
      signature: input.signature,
      slot,
      sourceTokenAddress: input.expectedSourceTokenAddress,
    }),
  };
}
