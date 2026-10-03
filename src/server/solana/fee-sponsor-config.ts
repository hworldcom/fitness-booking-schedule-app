import "server-only";

import { parseFeeSponsor } from "@/solana/fee-sponsor";

export function feeSponsorConfig() {
  return parseFeeSponsor({
    configuredAddress: process.env.SOLANA_FEE_SPONSOR_ADDRESS,
    keypairBase64: process.env.SOLANA_FEE_SPONSOR_KEYPAIR_BASE64,
  });
}
