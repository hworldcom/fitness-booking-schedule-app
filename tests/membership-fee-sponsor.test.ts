import assert from "node:assert/strict";
import test from "node:test";
import {
  createKeyPairFromPrivateKeyBytes,
  getAddressFromPublicKey,
} from "@solana/kit";
import { parseMembershipFeeSponsor } from "@/solana/membership-fee-sponsor";

async function testKeypairBytes() {
  const privateKeyBytes = new Uint8Array(32).fill(17);
  const keypair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
  const publicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", keypair.publicKey),
  );
  const bytes = new Uint8Array(64);
  bytes.set(privateKeyBytes, 0);
  bytes.set(publicKeyBytes, 32);
  return {
    address: await getAddressFromPublicKey(keypair.publicKey),
    encoded: Buffer.from(bytes).toString("base64"),
  };
}

test("fee sponsor accepts a matching base64 CLI keypair", async () => {
  const fixture = await testKeypairBytes();
  const sponsor = await parseMembershipFeeSponsor({
    configuredAddress: fixture.address,
    keypairBase64: fixture.encoded,
  });

  assert.equal(sponsor?.address, fixture.address);
});

test("fee sponsor rejects a public-address mismatch", async () => {
  const fixture = await testKeypairBytes();
  const sponsor = await parseMembershipFeeSponsor({
    configuredAddress: "11111111111111111111111111111111",
    keypairBase64: fixture.encoded,
  });

  assert.equal(sponsor, null);
});

test("fee sponsor rejects missing, malformed and wrong-length secrets", async () => {
  const fixture = await testKeypairBytes();

  assert.equal(
    await parseMembershipFeeSponsor({
      configuredAddress: fixture.address,
      keypairBase64: undefined,
    }),
    null,
  );
  assert.equal(
    await parseMembershipFeeSponsor({
      configuredAddress: fixture.address,
      keypairBase64: "not-base64",
    }),
    null,
  );
  assert.equal(
    await parseMembershipFeeSponsor({
      configuredAddress: fixture.address,
      keypairBase64: Buffer.alloc(32).toString("base64"),
    }),
    null,
  );
});
