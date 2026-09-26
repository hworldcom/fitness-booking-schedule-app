import "server-only";

import {
  MEMBERSHIP_PAYMENT_CLUSTER,
  MEMBERSHIP_PAYMENT_MINT_ADDRESS,
  MEMBERSHIP_PAYMENT_POOL_OWNER_ADDRESS,
  MEMBERSHIP_PAYMENT_POOL_TOKEN_ADDRESS,
  MEMBERSHIP_PAYMENT_TOKEN_DECIMALS,
  MEMBERSHIP_PAYMENT_TOKEN_PROGRAM_ADDRESS,
} from "@/solana/membership-payment";

export type MembershipPaymentConfig = Readonly<{
  cluster: typeof MEMBERSHIP_PAYMENT_CLUSTER;
  browserRpcUrl: string;
  serverRpcUrl: string;
  mintAddress: string;
  tokenProgramAddress: string;
  tokenDecimals: number;
  poolOwnerAddress: string;
  poolTokenAddress: string;
}>;

function rpcUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      )
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function membershipPaymentConfig(): MembershipPaymentConfig | null {
  if (process.env.SOLANA_CLUSTER !== "devnet") return null;
  const browserRpcUrl = rpcUrl(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
  const serverRpcUrl = rpcUrl(process.env.SOLANA_RPC_URL);
  if (!browserRpcUrl || !serverRpcUrl) return null;
  return Object.freeze({
    cluster: MEMBERSHIP_PAYMENT_CLUSTER,
    browserRpcUrl,
    serverRpcUrl,
    mintAddress: MEMBERSHIP_PAYMENT_MINT_ADDRESS,
    tokenProgramAddress: MEMBERSHIP_PAYMENT_TOKEN_PROGRAM_ADDRESS,
    tokenDecimals: MEMBERSHIP_PAYMENT_TOKEN_DECIMALS,
    poolOwnerAddress: MEMBERSHIP_PAYMENT_POOL_OWNER_ADDRESS,
    poolTokenAddress: MEMBERSHIP_PAYMENT_POOL_TOKEN_ADDRESS,
  });
}
