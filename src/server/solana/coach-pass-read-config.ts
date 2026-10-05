import "server-only";

import { address, type Address } from "@solana/kit";
import { MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS } from "@/solana/coach-pass";

export type CoachPassReadConfig = Readonly<{
  cluster: "devnet";
  serverRpcUrl: string;
  programAddress: Address;
}>;

export class CoachPassReadConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoachPassReadConfigurationError";
  }
}

export function parseCoachPassReadConfig(input: {
  cluster: string | undefined;
  serverRpcUrl: string | undefined;
  programAddress: string | undefined;
}): CoachPassReadConfig {
  if (input.cluster?.trim() !== "devnet") {
    throw new CoachPassReadConfigurationError(
      "SOLANA_CLUSTER must be devnet for public coach-pass reads.",
    );
  }
  let serverRpcUrl: string;
  try {
    const candidate = new URL(input.serverRpcUrl?.trim() ?? "");
    if (
      candidate.protocol !== "https:" ||
      !candidate.hostname ||
      candidate.hash
    ) {
      throw new Error("unsafe RPC URL");
    }
    serverRpcUrl = candidate.toString();
  } catch {
    throw new CoachPassReadConfigurationError(
      "SOLANA_RPC_URL must be a valid HTTPS endpoint.",
    );
  }

  let programAddress: Address;
  try {
    programAddress = address(input.programAddress?.trim() ?? "");
  } catch {
    throw new CoachPassReadConfigurationError(
      "NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID must be a valid address.",
    );
  }
  if (programAddress !== MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS) {
    throw new CoachPassReadConfigurationError(
      "Configured coach-pass program does not match the reviewed program identity.",
    );
  }
  return Object.freeze({ cluster: "devnet", serverRpcUrl, programAddress });
}

export function coachPassReadConfig() {
  return parseCoachPassReadConfig({
    cluster: process.env.SOLANA_CLUSTER,
    serverRpcUrl: process.env.SOLANA_RPC_URL,
    programAddress: process.env.NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID,
  });
}
