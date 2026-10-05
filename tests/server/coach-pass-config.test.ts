import assert from "node:assert/strict";
import test from "node:test";
import {
  createKeyPairFromPrivateKeyBytes,
  generateKeyPairSigner,
  getAddressFromPublicKey,
} from "@solana/kit";
import {
  CoachPassConfigurationError,
  coachPassDevnetConfig,
  parseCoachPassDevnetConfig,
} from "../../src/server/solana/coach-pass-config";
import { MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS } from "../../src/solana/coach-pass";

async function validInput() {
  const signer = await generateKeyPairSigner();
  return {
    cluster: "devnet",
    browserRpcUrl: "https://api.devnet.solana.com",
    serverRpcUrl: "https://private-rpc.example/rpc?api-key=secret",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    sponsor: { address: signer.address, signer },
  } as const;
}

test("coach-pass configuration pins Devnet and the reviewed program identity", async () => {
  const input = await validInput();
  const config = parseCoachPassDevnetConfig(input);

  assert.equal(config.cluster, "devnet");
  assert.equal(config.programAddress, MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS);
  assert.equal(config.sponsor.address, input.sponsor.address);
  assert.equal(
    config.serverRpcUrl,
    "https://private-rpc.example/rpc?api-key=secret",
  );
});

test("coach-pass configuration rejects unsafe or incomplete runtime values", async () => {
  const input = await validInput();
  for (const invalid of [
    { ...input, cluster: "mainnet-beta" },
    { ...input, browserRpcUrl: undefined },
    { ...input, browserRpcUrl: "http://api.devnet.solana.com" },
    {
      ...input,
      browserRpcUrl: "https://user:password@api.devnet.solana.com",
    },
    { ...input, browserRpcUrl: "https://api.devnet.solana.com/#fragment" },
    { ...input, serverRpcUrl: "not-a-url" },
    { ...input, programAddress: "not-an-address" },
    { ...input, programAddress: "11111111111111111111111111111111" },
    { ...input, sponsor: null },
  ]) {
    assert.throws(
      () => parseCoachPassDevnetConfig(invalid),
      (error: unknown) => error instanceof CoachPassConfigurationError,
    );
  }
});

test("runtime configuration wires the documented environment without exposing key bytes", async (t) => {
  const names = [
    "SOLANA_CLUSTER",
    "NEXT_PUBLIC_SOLANA_RPC_URL",
    "SOLANA_RPC_URL",
    "NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID",
    "SOLANA_FEE_SPONSOR_ADDRESS",
    "SOLANA_FEE_SPONSOR_KEYPAIR_BASE64",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  t.after(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const privateKeyBytes = new Uint8Array(32).fill(29);
  const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
  const publicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(privateKeyBytes, 0);
  keypairBytes.set(publicKeyBytes, 32);
  const sponsorAddress = await getAddressFromPublicKey(keyPair.publicKey);

  process.env.SOLANA_CLUSTER = "devnet";
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
  process.env.SOLANA_RPC_URL = "https://private-rpc.example/rpc";
  process.env.NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID =
    MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS;
  process.env.SOLANA_FEE_SPONSOR_ADDRESS = sponsorAddress;
  process.env.SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 =
    Buffer.from(keypairBytes).toString("base64");

  try {
    const config = await coachPassDevnetConfig();
    assert.equal(config.sponsor.address, sponsorAddress);
    assert.equal(
      "keypairBase64" in config.sponsor,
      false,
      "runtime config must expose only the signer object, never encoded key bytes",
    );
  } finally {
    privateKeyBytes.fill(0);
    publicKeyBytes.fill(0);
    keypairBytes.fill(0);
  }
});
