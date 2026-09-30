import type { Address } from "@solana/kit";

type MembershipTokenAccount =
  | Readonly<{ exists: false }>
  | Readonly<{
      exists: true;
      programAddress: Address;
      data: Readonly<{
        owner: Address;
        mint: Address;
        amount: bigint;
      }>;
    }>;

export type MembershipPaymentAccountCheckResult =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status:
        | "rpc-unavailable"
        | "source-account-unavailable"
        | "source-account-mismatch"
        | "destination-account-unavailable"
        | "destination-mismatch"
        | "insufficient-eurc";
    }>;

export async function checkMembershipPaymentTokenAccounts(input: {
  sourceAddress: Address;
  sourceOwnerAddress: Address;
  destinationAddress: Address;
  destinationOwnerAddress: Address;
  mintAddress: Address;
  tokenProgramAddress: Address;
  requiredAmount: bigint;
  fetchAccounts: (
    addresses: readonly Address[],
  ) => Promise<readonly MembershipTokenAccount[]>;
}): Promise<MembershipPaymentAccountCheckResult> {
  let accounts: readonly MembershipTokenAccount[];
  try {
    accounts = await input.fetchAccounts([
      input.sourceAddress,
      input.destinationAddress,
    ]);
  } catch {
    return Object.freeze({ status: "rpc-unavailable" });
  }

  if (accounts.length !== 2) {
    return Object.freeze({ status: "rpc-unavailable" });
  }
  const [sourceAccount, destinationAccount] = accounts;
  if (!sourceAccount?.exists) {
    return Object.freeze({ status: "source-account-unavailable" });
  }
  if (!destinationAccount?.exists) {
    return Object.freeze({ status: "destination-account-unavailable" });
  }
  if (
    sourceAccount.programAddress !== input.tokenProgramAddress ||
    sourceAccount.data.owner !== input.sourceOwnerAddress ||
    sourceAccount.data.mint !== input.mintAddress
  ) {
    return Object.freeze({ status: "source-account-mismatch" });
  }
  if (
    destinationAccount.programAddress !== input.tokenProgramAddress ||
    destinationAccount.data.owner !== input.destinationOwnerAddress ||
    destinationAccount.data.mint !== input.mintAddress
  ) {
    return Object.freeze({ status: "destination-mismatch" });
  }
  if (sourceAccount.data.amount < input.requiredAmount) {
    return Object.freeze({ status: "insufficient-eurc" });
  }
  return Object.freeze({ status: "ready" });
}
