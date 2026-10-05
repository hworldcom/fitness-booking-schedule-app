import "server-only";

import { address, type Address } from "@solana/kit";
import { MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS } from "@/solana/coach-pass";
import type { FeeSponsor } from "@/solana/fee-sponsor";
import { feeSponsorConfig } from "./fee-sponsor-config";

export type CoachPassDevnetConfig = Readonly<{
  cluster: "devnet";
  browserRpcUrl: string;
  serverRpcUrl: string;
  programAddress: Address;
  sponsor: FeeSponsor;
}>;

export type CoachPassBootstrapConfig = Readonly<
  CoachPassDevnetConfig & {
    recoveryAuthority: Address;
  }
>;

export class CoachPassConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoachPassConfigurationError";
  }
}

function rpcUrl(value: string | undefined, visibility: "browser" | "server") {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.hash) return null;
    if (visibility === "browser" && (url.username || url.password)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseCoachPassDevnetConfig(input: {
  cluster: string | undefined;
  browserRpcUrl: string | undefined;
  serverRpcUrl: string | undefined;
  programAddress: string | undefined;
  sponsor: FeeSponsor | null;
}): CoachPassDevnetConfig {
  if (input.cluster?.trim() !== "devnet") {
    throw new CoachPassConfigurationError(
      "SOLANA_CLUSTER must be devnet for coach-pass operations.",
    );
  }
  const browserRpcUrl = rpcUrl(input.browserRpcUrl, "browser");
  const serverRpcUrl = rpcUrl(input.serverRpcUrl, "server");
  if (!browserRpcUrl || !serverRpcUrl) {
    throw new CoachPassConfigurationError(
      "Coach-pass RPC URLs must be valid HTTPS endpoints.",
    );
  }

  let programAddress: Address;
  try {
    programAddress = address(input.programAddress?.trim() ?? "");
  } catch {
    throw new CoachPassConfigurationError(
      "NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID must be a valid address.",
    );
  }
  if (programAddress !== MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS) {
    throw new CoachPassConfigurationError(
      "Configured coach-pass program does not match the reviewed program identity.",
    );
  }
  if (!input.sponsor) {
    throw new CoachPassConfigurationError(
      "A matching server-only fee sponsor is required.",
    );
  }
  return Object.freeze({
    cluster: "devnet",
    browserRpcUrl,
    serverRpcUrl,
    programAddress,
    sponsor: input.sponsor,
  });
}

export function parseCoachPassBootstrapConfig(input: {
  cluster: string | undefined;
  browserRpcUrl: string | undefined;
  serverRpcUrl: string | undefined;
  programAddress: string | undefined;
  sponsor: FeeSponsor | null;
  recoveryAuthority: string | undefined;
}): CoachPassBootstrapConfig {
  const config = parseCoachPassDevnetConfig(input);
  let recoveryAuthority: Address;
  try {
    recoveryAuthority = address(input.recoveryAuthority?.trim() ?? "");
  } catch {
    throw new CoachPassConfigurationError(
      "SOLANA_RECOVERY_AUTHORITY_ADDRESS must be a valid address.",
    );
  }
  if (recoveryAuthority === config.sponsor.address) {
    throw new CoachPassConfigurationError(
      "The recovery authority must be separate from the fee sponsor.",
    );
  }
  return Object.freeze({ ...config, recoveryAuthority });
}

export async function coachPassDevnetConfig() {
  return parseCoachPassDevnetConfig({
    cluster: process.env.SOLANA_CLUSTER,
    browserRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    serverRpcUrl: process.env.SOLANA_RPC_URL,
    programAddress: process.env.NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID,
    sponsor: await feeSponsorConfig(),
  });
}

export async function coachPassBootstrapConfig() {
  return parseCoachPassBootstrapConfig({
    cluster: process.env.SOLANA_CLUSTER,
    browserRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    serverRpcUrl: process.env.SOLANA_RPC_URL,
    programAddress: process.env.NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID,
    sponsor: await feeSponsorConfig(),
    recoveryAuthority: process.env.SOLANA_RECOVERY_AUTHORITY_ADDRESS,
  });
}
