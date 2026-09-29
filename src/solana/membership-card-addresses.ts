import {
  address,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from "@solana/kit";

export const MEMBERSHIP_CARD_PROGRAM_ADDRESS = address(
  "GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr",
);

export const MEMBERSHIP_LINEAGE_SEED = "membership_card";
export const MEMBERSHIP_ASSET_SEED = "membership_asset";

function assertLineageId(lineageId: Uint8Array): void {
  if (lineageId.length !== 32 || lineageId.every((byte) => byte === 0)) {
    throw new Error(
      "Membership card lineage IDs must be non-zero 32-byte values.",
    );
  }
}

function encodeGeneration(generation: number): Uint8Array {
  if (
    !Number.isSafeInteger(generation) ||
    generation < 0 ||
    generation > 0xffff_ffff
  ) {
    throw new Error(
      "Membership card generation must be an unsigned 32-bit integer.",
    );
  }

  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, generation, true);
  return bytes;
}

export async function deriveMembershipCardLineageAddress(
  lineageId: Uint8Array,
  programAddress: Address = MEMBERSHIP_CARD_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  assertLineageId(lineageId);
  return getProgramDerivedAddress({
    programAddress,
    seeds: [MEMBERSHIP_LINEAGE_SEED, lineageId],
  });
}

export async function deriveMembershipCardAssetAddress(
  lineageId: Uint8Array,
  generation: number,
  programAddress: Address = MEMBERSHIP_CARD_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  assertLineageId(lineageId);
  return getProgramDerivedAddress({
    programAddress,
    seeds: [MEMBERSHIP_ASSET_SEED, lineageId, encodeGeneration(generation)],
  });
}
