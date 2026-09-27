import { address, type Address } from "@solana/kit";

export { MEMBERSHIP_PAYMENT_CLUSTER } from "@/domain/membership-activation";
export type { MembershipPaymentQuote } from "@/domain/membership-activation";
export const MEMBERSHIP_PAYMENT_CLUSTER_LABEL = "Solana Devnet";
export const MEMBERSHIP_PAYMENT_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const MEMBERSHIP_PAYMENT_CURRENCY = "EURC" as const;
export const MEMBERSHIP_PAYMENT_MINT_ADDRESS = address(
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
);
export const MEMBERSHIP_PAYMENT_TOKEN_PROGRAM_ADDRESS = address(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const MEMBERSHIP_PAYMENT_TOKEN_DECIMALS = 6;
export const MEMBERSHIP_PAYMENT_POOL_OWNER_ADDRESS = address(
  "3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL",
);
export const MEMBERSHIP_PAYMENT_POOL_TOKEN_ADDRESS = address(
  "BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8",
);
export const MEMBERSHIP_PAYMENT_MEMO_PREFIX = "movx-membership:v1:";
export const MEMBERSHIP_PAYMENT_EXPLORER_BASE_URL =
  "https://explorer.solana.com/tx/";

export function membershipPaymentMemo(operationId: string) {
  return `${MEMBERSHIP_PAYMENT_MEMO_PREFIX}${operationId}`;
}

export function isMembershipPaymentDevnetGenesisHash(value: unknown) {
  return value === MEMBERSHIP_PAYMENT_DEVNET_GENESIS_HASH;
}

export function membershipPaymentExplorerUrl(signature: string) {
  return `${MEMBERSHIP_PAYMENT_EXPLORER_BASE_URL}${encodeURIComponent(signature)}?cluster=devnet`;
}

export function membershipPaymentAmountLabel(
  amountBaseUnits: string,
  decimals = MEMBERSHIP_PAYMENT_TOKEN_DECIMALS,
) {
  const amount = BigInt(amountBaseUnits);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = (amount % divisor).toString().padStart(decimals, "0");
  const trimmedFractional = fractional.replace(/0+$/, "");
  return trimmedFractional ? `${whole}.${trimmedFractional}` : whole.toString();
}

export function asMembershipPaymentAddress(value: string) {
  return address(value) as Address;
}
