import "server-only";

import { parseMembershipFeeSponsor } from "@/solana/membership-fee-sponsor";

export function membershipFeeSponsorConfig() {
  return parseMembershipFeeSponsor({
    configuredAddress: process.env.SOLANA_FEE_SPONSOR_ADDRESS,
    keypairBase64: process.env.SOLANA_FEE_SPONSOR_KEYPAIR_BASE64,
  });
}
