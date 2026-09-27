import {
  address,
  createKeyPairSignerFromBytes,
  getBase64Encoder,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";

export type MembershipFeeSponsor = Readonly<{
  address: Address;
  signer: KeyPairSigner;
}>;

export async function parseMembershipFeeSponsor(input: {
  configuredAddress: string | undefined;
  keypairBase64: string | undefined;
}): Promise<MembershipFeeSponsor | null> {
  const configuredAddress = input.configuredAddress?.trim();
  const encodedKeypair = input.keypairBase64?.trim();
  if (!configuredAddress || !encodedKeypair) return null;

  let sponsorAddress: Address;
  let keypairBytes: Uint8Array;
  try {
    sponsorAddress = address(configuredAddress);
    keypairBytes = new Uint8Array(
      getBase64Encoder().encode(encodedKeypair) as Uint8Array,
    );
  } catch {
    return null;
  }
  if (keypairBytes.byteLength !== 64) {
    keypairBytes.fill(0);
    return null;
  }

  try {
    const signer = await createKeyPairSignerFromBytes(keypairBytes);
    if (signer.address !== sponsorAddress) return null;
    return Object.freeze({ address: sponsorAddress, signer });
  } catch {
    return null;
  } finally {
    keypairBytes.fill(0);
  }
}
