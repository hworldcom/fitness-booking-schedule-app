import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressDecoder,
  getBase64EncodedWireTransaction,
  signTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type AccountMeta,
  type AccountSignerMeta,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  deriveMembershipCardAssetAddress,
  deriveMembershipCardLineageAddress,
  MEMBERSHIP_CARD_PROGRAM_ADDRESS,
} from "../src/solana/membership-card-addresses";

const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const MPL_CORE_ADDRESS = address(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);
const PROGRAM_ARTIFACT = "target/deploy/movx_membership_card.so" as const;
const ACTIVE_NAME = "MovX Basic Membership";
const INACTIVE_NAME = "MovX Membership · Inactive";
const FIXTURE_LAMPORTS = 10_000_000_000;
const RPC_TIMEOUT_MS = 15_000;

type JsonRpcError = Readonly<{
  code: number;
  message: string;
  data?: unknown;
}>;

class RpcError extends Error {
  constructor(
    readonly method: string,
    readonly rpcError: JsonRpcError,
  ) {
    super(`${method} failed (${rpcError.code}): ${rpcError.message}`);
    this.name = "RpcError";
  }
}

type RpcAccount = Readonly<{
  data: readonly [string, "base64"];
  executable: boolean;
  lamports: number;
  owner: string;
}>;

type Projection = Readonly<{
  periodId: Uint8Array;
  status: "active" | "expired";
  plan: "basic" | "classic";
  validFrom: bigint;
  validUntil: bigint;
  includedTotal: number;
  used: number;
  remaining: number;
}>;

type LineageState = Readonly<{
  schemaVersion: number;
  lineageId: Uint8Array;
  operatorAuthority: Address;
  currentMemberWallet: Address;
  currentAsset: Address;
  currentPeriodId: Uint8Array;
  generation: number;
  projectionVersion: bigint;
  status: "active" | "expired";
  includedTotal: number;
  used: number;
  remaining: number;
}>;

type CoreAsset = Readonly<{
  owner: Address;
  updateAuthority: Address;
  name: string;
  uri: string;
}>;

type RehearsalInstruction = Instruction<
  string,
  readonly (AccountMeta | AccountSignerMeta)[]
>;

class ByteWriter {
  readonly #chunks: Buffer[] = [];

  u8(value: number) {
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeUInt8(value);
    this.#chunks.push(buffer);
    return this;
  }

  u16(value: number) {
    const buffer = Buffer.allocUnsafe(2);
    buffer.writeUInt16LE(value);
    this.#chunks.push(buffer);
    return this;
  }

  u32(value: number) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value);
    this.#chunks.push(buffer);
    return this;
  }

  u64(value: bigint) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(value);
    this.#chunks.push(buffer);
    return this;
  }

  i64(value: bigint) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigInt64LE(value);
    this.#chunks.push(buffer);
    return this;
  }

  bytes(value: Uint8Array) {
    this.#chunks.push(Buffer.from(value));
    return this;
  }

  string(value: string) {
    const encoded = Buffer.from(value, "utf8");
    this.u32(encoded.length);
    this.#chunks.push(encoded);
    return this;
  }

  finish() {
    return new Uint8Array(Buffer.concat(this.#chunks));
  }
}

function instructionDiscriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function accountDiscriminator(name: string) {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function encodeProjection(writer: ByteWriter, projection: Projection) {
  assert.equal(projection.periodId.length, 32);
  writer
    .bytes(projection.periodId)
    .u8(projection.status === "active" ? 0 : 1)
    .u8(projection.plan === "basic" ? 0 : 1)
    .i64(projection.validFrom)
    .i64(projection.validUntil)
    .u16(projection.includedTotal)
    .u16(projection.used)
    .u16(projection.remaining);
}

function initializeData(
  lineageId: Uint8Array,
  projection: Projection,
  metadataUri: string,
) {
  const writer = new ByteWriter().bytes(
    instructionDiscriminator("initialize_membership_card"),
  );
  writer.bytes(lineageId);
  encodeProjection(writer, projection);
  return writer.string(metadataUri).finish();
}

function updateData(
  expectedProjectionVersion: bigint,
  expectedGeneration: number,
  projection: Projection,
  metadataUri: string,
) {
  const writer = new ByteWriter()
    .bytes(instructionDiscriminator("update_membership_card"))
    .u64(expectedProjectionVersion)
    .u32(expectedGeneration);
  encodeProjection(writer, projection);
  return writer.string(metadataUri).finish();
}

function replacementData(
  expectedProjectionVersion: bigint,
  expectedGeneration: number,
  newGeneration: number,
  projection: Projection,
  inactiveMetadataUri: string,
  activeMetadataUri: string,
) {
  const writer = new ByteWriter()
    .bytes(instructionDiscriminator("replace_membership_card_wallet"))
    .u64(expectedProjectionVersion)
    .u32(expectedGeneration)
    .u32(newGeneration);
  encodeProjection(writer, projection);
  return writer.string(inactiveMetadataUri).string(activeMetadataUri).finish();
}

function assertCurrentData(expectedGeneration: number) {
  return new ByteWriter()
    .bytes(instructionDiscriminator("assert_current_membership_card"))
    .u32(expectedGeneration)
    .finish();
}

function initializeInstruction(input: {
  lineage: Address;
  asset: Address;
  memberWallet: Address;
  feePayer: KeyPairSigner;
  operator: KeyPairSigner;
  data: Uint8Array;
}): RehearsalInstruction {
  return {
    programAddress: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    accounts: [
      { address: input.lineage, role: AccountRole.WRITABLE },
      { address: input.asset, role: AccountRole.WRITABLE },
      { address: input.memberWallet, role: AccountRole.READONLY },
      {
        address: input.feePayer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: input.feePayer,
      },
      {
        address: input.operator.address,
        role: AccountRole.READONLY_SIGNER,
        signer: input.operator,
      },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: input.data,
  };
}

function updateInstruction(input: {
  lineage: Address;
  asset: Address;
  feePayer: KeyPairSigner;
  operator: KeyPairSigner;
  data: Uint8Array;
}): RehearsalInstruction {
  return {
    programAddress: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    accounts: [
      { address: input.lineage, role: AccountRole.WRITABLE },
      { address: input.asset, role: AccountRole.WRITABLE },
      {
        address: input.feePayer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: input.feePayer,
      },
      {
        address: input.operator.address,
        role: AccountRole.READONLY_SIGNER,
        signer: input.operator,
      },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: input.data,
  };
}

function replacementInstruction(input: {
  lineage: Address;
  oldAsset: Address;
  newAsset: Address;
  newMemberWallet: Address;
  feePayer: KeyPairSigner;
  operator: KeyPairSigner;
  data: Uint8Array;
}): RehearsalInstruction {
  return {
    programAddress: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    accounts: [
      { address: input.lineage, role: AccountRole.WRITABLE },
      { address: input.oldAsset, role: AccountRole.WRITABLE },
      { address: input.newAsset, role: AccountRole.WRITABLE },
      { address: input.newMemberWallet, role: AccountRole.READONLY },
      {
        address: input.feePayer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: input.feePayer,
      },
      {
        address: input.operator.address,
        role: AccountRole.READONLY_SIGNER,
        signer: input.operator,
      },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: input.data,
  };
}

function assertCurrentInstruction(
  lineage: Address,
  asset: Address,
  expectedGeneration: number,
): RehearsalInstruction {
  return {
    programAddress: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    accounts: [
      { address: lineage, role: AccountRole.READONLY },
      { address: asset, role: AccountRole.READONLY },
    ],
    data: assertCurrentData(expectedGeneration),
  };
}

function transferCoreAssetInstruction(input: {
  asset: Address;
  feePayer: KeyPairSigner;
  owner: KeyPairSigner;
  newOwner: Address;
}): RehearsalInstruction {
  return {
    programAddress: MPL_CORE_ADDRESS,
    accounts: [
      { address: input.asset, role: AccountRole.WRITABLE },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
      {
        address: input.feePayer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: input.feePayer,
      },
      {
        address: input.owner.address,
        role: AccountRole.READONLY_SIGNER,
        signer: input.owner,
      },
      { address: input.newOwner, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
    ],
    data: new Uint8Array([14, 0]),
  };
}

async function reservePort() {
  const server = createServer();
  server.unref();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const result = server.address();
  assert(result && typeof result === "object");
  const port = result.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function rpc<T>(url: string, method: string, params: unknown[] = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  assert.equal(response.ok, true, `${method} returned HTTP ${response.status}`);
  const envelope = (await response.json()) as {
    result?: T;
    error?: JsonRpcError;
  };
  if (envelope.error) throw new RpcError(method, envelope.error);
  assert("result" in envelope, `${method} returned no result`);
  return envelope.result as T;
}

async function waitForSurfpool(
  child: ChildProcess,
  rpcUrl: string,
  diagnostics: () => string,
) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Surfpool exited with code ${child.exitCode}.\n${diagnostics()}`,
      );
    }
    try {
      const health = await rpc<string>(rpcUrl, "getHealth");
      if (health === "ok") return;
    } catch {
      // Surfpool is still binding its RPC port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Surfpool did not become ready.\n${diagnostics()}`);
}

async function stopSurfpool(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function deployProgram(rpcUrl: string) {
  const program = await readFile(PROGRAM_ARTIFACT);
  const chunkSize = 128 * 1024;
  for (let offset = 0; offset < program.length; offset += chunkSize) {
    const chunk = program.subarray(offset, offset + chunkSize).toString("hex");
    await rpc(rpcUrl, "surfnet_writeProgram", [
      MEMBERSHIP_CARD_PROGRAM_ADDRESS,
      chunk,
      offset,
    ]);
  }
}

async function fundFixture(rpcUrl: string, fixture: Address) {
  await rpc(rpcUrl, "surfnet_setAccount", [
    fixture,
    {
      lamports: FIXTURE_LAMPORTS,
      owner: SYSTEM_PROGRAM_ADDRESS,
      executable: false,
    },
  ]);
}

async function getAccount(rpcUrl: string, account: Address) {
  const response = await rpc<{ value: RpcAccount | null }>(
    rpcUrl,
    "getAccountInfo",
    [account, { commitment: "processed", encoding: "base64" }],
  );
  assert(response.value, `Account ${account} does not exist`);
  return response.value;
}

function decodeAccountData(account: RpcAccount) {
  assert.equal(account.data[1], "base64");
  return Buffer.from(account.data[0], "base64");
}

async function getLineageState(rpcUrl: string, lineage: Address) {
  const account = await getAccount(rpcUrl, lineage);
  assert.equal(account.owner, MEMBERSHIP_CARD_PROGRAM_ADDRESS);
  const data = decodeAccountData(account);
  assert.equal(data.length, 238);
  assert.deepEqual(data.subarray(0, 8), accountDiscriminator("MembershipCard"));
  const decodeAddress = (start: number) =>
    getAddressDecoder().decode(data.subarray(start, start + 32));
  return {
    schemaVersion: data.readUInt8(8),
    lineageId: new Uint8Array(data.subarray(10, 42)),
    operatorAuthority: decodeAddress(42),
    currentMemberWallet: decodeAddress(74),
    currentAsset: decodeAddress(106),
    currentPeriodId: new Uint8Array(data.subarray(138, 170)),
    generation: data.readUInt32LE(170),
    projectionVersion: data.readBigUInt64LE(174),
    status: data.readUInt8(182) === 0 ? "active" : "expired",
    includedTotal: data.readUInt16LE(200),
    used: data.readUInt16LE(202),
    remaining: data.readUInt16LE(204),
  } satisfies LineageState;
}

function readBorshString(data: Buffer, offset: number) {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  assert(end <= data.length, "Core asset string extends past account data");
  return { value: data.subarray(start, end).toString("utf8"), offset: end };
}

async function getCoreAsset(rpcUrl: string, asset: Address) {
  const account = await getAccount(rpcUrl, asset);
  assert.equal(account.owner, MPL_CORE_ADDRESS);
  const data = decodeAccountData(account);
  assert.equal(data.readUInt8(0), 1, "Expected a Metaplex Core AssetV1");
  assert.equal(data.readUInt8(33), 1, "Expected an address update authority");
  const owner = getAddressDecoder().decode(data.subarray(1, 33));
  const updateAuthority = getAddressDecoder().decode(data.subarray(34, 66));
  const name = readBorshString(data, 66);
  const uri = readBorshString(data, name.offset);
  return {
    owner,
    updateAuthority,
    name: name.value,
    uri: uri.value,
  } satisfies CoreAsset;
}

async function buildSignedTransaction(
  rpcUrl: string,
  feePayer: KeyPairSigner,
  instruction: RehearsalInstruction,
) {
  const latest = await rpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>(rpcUrl, "getLatestBlockhash", [{ commitment: "processed" }]);
  const message = appendTransactionMessageInstruction(
    instruction,
    setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: blockhash(latest.value.blockhash),
        lastValidBlockHeight: BigInt(latest.value.lastValidBlockHeight),
      },
      setTransactionMessageFeePayerSigner(
        feePayer,
        createTransactionMessage({ version: "legacy" }),
      ),
    ),
  );
  const transaction = await signTransactionMessageWithSigners(message);
  return getBase64EncodedWireTransaction(transaction);
}

async function simulate(rpcUrl: string, wireTransaction: string) {
  return rpc<{
    value: {
      err: unknown;
      logs: string[] | null;
      unitsConsumed?: number;
    };
  }>(rpcUrl, "simulateTransaction", [
    wireTransaction,
    {
      commitment: "processed",
      encoding: "base64",
      sigVerify: true,
    },
  ]);
}

async function waitForSignature(rpcUrl: string, signature: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const statuses = await rpc<{
      value: Array<{ confirmationStatus?: string; err: unknown } | null>;
    }>(rpcUrl, "getSignatureStatuses", [[signature]]);
    if (statuses.value[0]) return statuses.value[0];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Transaction ${signature} was not processed`);
}

async function sendSuccessfulInstruction(
  rpcUrl: string,
  feePayer: KeyPairSigner,
  label: string,
  instruction: RehearsalInstruction,
) {
  const wireTransaction = await buildSignedTransaction(
    rpcUrl,
    feePayer,
    instruction,
  );
  const simulation = await simulate(rpcUrl, wireTransaction);
  assert.equal(
    simulation.value.err,
    null,
    `${label} simulation failed:\n${simulation.value.logs?.join("\n") ?? "no logs"}`,
  );
  const signature = await rpc<string>(rpcUrl, "sendTransaction", [
    wireTransaction,
    {
      encoding: "base64",
      preflightCommitment: "processed",
      skipPreflight: false,
    },
  ]);
  const status = await waitForSignature(rpcUrl, signature);
  assert.equal(status.err, null, `${label} transaction failed`);
  return {
    signature,
    unitsConsumed: simulation.value.unitsConsumed ?? null,
  };
}

async function expectSimulationFailure(
  rpcUrl: string,
  feePayer: KeyPairSigner,
  label: string,
  instruction: RehearsalInstruction,
) {
  const wireTransaction = await buildSignedTransaction(
    rpcUrl,
    feePayer,
    instruction,
  );
  const simulation = await simulate(rpcUrl, wireTransaction);
  assert.notEqual(
    simulation.value.err,
    null,
    `${label} unexpectedly succeeded`,
  );
  return simulation.value.err;
}

async function submitExpectedFailure(
  rpcUrl: string,
  feePayer: KeyPairSigner,
  label: string,
  instruction: RehearsalInstruction,
) {
  const wireTransaction = await buildSignedTransaction(
    rpcUrl,
    feePayer,
    instruction,
  );
  const simulation = await simulate(rpcUrl, wireTransaction);
  assert.notEqual(
    simulation.value.err,
    null,
    `${label} unexpectedly simulated`,
  );
  try {
    const signature = await rpc<string>(rpcUrl, "sendTransaction", [
      wireTransaction,
      {
        encoding: "base64",
        preflightCommitment: "processed",
        skipPreflight: true,
      },
    ]);
    const status = await waitForSignature(rpcUrl, signature);
    assert.notEqual(status.err, null, `${label} unexpectedly committed`);
  } catch (error) {
    assert(error instanceof RpcError, `${label} failed outside the runtime`);
  }
}

async function run() {
  const [rpcPort, wsPort] = await Promise.all([reservePort(), reservePort()]);
  assert.notEqual(rpcPort, wsPort);
  const rpcUrl = `http://127.0.0.1:${rpcPort}`;
  const output: string[] = [];
  const surfpool = spawn(
    "surfpool",
    [
      "start",
      "--ci",
      "--no-deploy",
      "--network",
      "devnet",
      "--airdrop-amount",
      "0",
      "--port",
      String(rpcPort),
      "--ws-port",
      String(wsPort),
    ],
    {
      env: { ...process.env, NO_DNA: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  surfpool.stdout?.on("data", (chunk) => output.push(String(chunk)));
  surfpool.stderr?.on("data", (chunk) => output.push(String(chunk)));

  try {
    await waitForSurfpool(surfpool, rpcUrl, () => output.join(""));
    await deployProgram(rpcUrl);

    const movxProgram = await getAccount(
      rpcUrl,
      MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    );
    assert.equal(movxProgram.executable, true);
    const coreProgram = await getAccount(rpcUrl, MPL_CORE_ADDRESS);
    assert.equal(coreProgram.executable, true);

    const [feePayer, operator, memberOne, memberTwo, outsider, wrongOperator] =
      await Promise.all([
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
      ]);
    await Promise.all(
      [feePayer, operator, memberOne, memberTwo, outsider, wrongOperator].map(
        (signer) => fundFixture(rpcUrl, signer.address),
      ),
    );

    const lineageId = new Uint8Array(32).fill(9);
    const firstPeriodId = new Uint8Array(32).fill(11);
    const secondPeriodId = new Uint8Array(32).fill(12);
    const [lineage] = await deriveMembershipCardLineageAddress(lineageId);
    const [firstAsset] = await deriveMembershipCardAssetAddress(lineageId, 0);
    const [replacementAsset] = await deriveMembershipCardAssetAddress(
      lineageId,
      1,
    );
    const [failedReplacementAsset] = await deriveMembershipCardAssetAddress(
      lineageId,
      2,
    );
    const firstProjection: Projection = {
      periodId: firstPeriodId,
      status: "active",
      plan: "basic",
      validFrom: BigInt(1_000),
      validUntil: BigInt(2_000),
      includedTotal: 10,
      used: 0,
      remaining: 10,
    };
    const usageProjection: Projection = {
      ...firstProjection,
      used: 3,
      remaining: 7,
    };
    const expiredProjection: Projection = {
      ...usageProjection,
      status: "expired",
    };
    const laterProjection: Projection = {
      periodId: secondPeriodId,
      status: "active",
      plan: "basic",
      validFrom: BigInt(2_000),
      validUntil: BigInt(3_000),
      includedTotal: 10,
      used: 0,
      remaining: 10,
    };

    const results = [];
    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "initialize membership card",
        initializeInstruction({
          lineage,
          asset: firstAsset,
          memberWallet: memberOne.address,
          feePayer,
          operator,
          data: initializeData(
            lineageId,
            firstProjection,
            "https://example.invalid/movx/basic-active-v1.json",
          ),
        }),
      ),
    );
    let lineageState = await getLineageState(rpcUrl, lineage);
    assert.equal(lineageState.schemaVersion, 1);
    assert.deepEqual(lineageState.lineageId, lineageId);
    assert.equal(lineageState.operatorAuthority, operator.address);
    assert.equal(lineageState.currentMemberWallet, memberOne.address);
    assert.equal(lineageState.currentAsset, firstAsset);
    assert.equal(lineageState.generation, 0);
    assert.equal(lineageState.projectionVersion, BigInt(1));
    const assetState = await getCoreAsset(rpcUrl, firstAsset);
    assert.equal(assetState.owner, memberOne.address);
    assert.equal(assetState.updateAuthority, lineage);
    assert.equal(assetState.name, ACTIVE_NAME);

    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "validate current card",
        assertCurrentInstruction(lineage, firstAsset, 0),
      ),
    );
    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "update usage projection",
        updateInstruction({
          lineage,
          asset: firstAsset,
          feePayer,
          operator,
          data: updateData(
            BigInt(1),
            0,
            usageProjection,
            "https://example.invalid/movx/basic-active-v2.json",
          ),
        }),
      ),
    );
    lineageState = await getLineageState(rpcUrl, lineage);
    assert.equal(lineageState.projectionVersion, BigInt(2));
    assert.equal(lineageState.used, 3);
    assert.equal(lineageState.remaining, 7);

    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "replayed usage update",
      updateInstruction({
        lineage,
        asset: firstAsset,
        feePayer,
        operator,
        data: updateData(
          BigInt(1),
          0,
          usageProjection,
          "https://example.invalid/movx/replay.json",
        ),
      }),
    );
    assert.equal(
      (await getLineageState(rpcUrl, lineage)).projectionVersion,
      BigInt(2),
    );

    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "expire projection",
        updateInstruction({
          lineage,
          asset: firstAsset,
          feePayer,
          operator,
          data: updateData(
            BigInt(2),
            0,
            expiredProjection,
            "https://example.invalid/movx/basic-expired.json",
          ),
        }),
      ),
    );
    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "expired card validation",
      assertCurrentInstruction(lineage, firstAsset, 0),
    );

    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "reactivate later same-wallet period",
        updateInstruction({
          lineage,
          asset: firstAsset,
          feePayer,
          operator,
          data: updateData(
            BigInt(3),
            0,
            laterProjection,
            "https://example.invalid/movx/basic-renewed.json",
          ),
        }),
      ),
    );
    lineageState = await getLineageState(rpcUrl, lineage);
    assert.equal(lineageState.currentAsset, firstAsset);
    assert.equal(lineageState.generation, 0);
    assert.equal(lineageState.projectionVersion, BigInt(4));
    assert.deepEqual(lineageState.currentPeriodId, secondPeriodId);

    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "frozen owner transfer",
      transferCoreAssetInstruction({
        asset: firstAsset,
        feePayer,
        owner: memberOne,
        newOwner: outsider.address,
      }),
    );
    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "wrong operator update",
      updateInstruction({
        lineage,
        asset: firstAsset,
        feePayer,
        operator: wrongOperator,
        data: updateData(
          BigInt(4),
          0,
          laterProjection,
          "https://example.invalid/movx/wrong-operator.json",
        ),
      }),
    );
    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "operator and sponsor role collision",
      updateInstruction({
        lineage,
        asset: firstAsset,
        feePayer: operator,
        operator,
        data: updateData(
          BigInt(4),
          0,
          laterProjection,
          "https://example.invalid/movx/role-collision.json",
        ),
      }),
    );

    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "replace member wallet",
        replacementInstruction({
          lineage,
          oldAsset: firstAsset,
          newAsset: replacementAsset,
          newMemberWallet: memberTwo.address,
          feePayer,
          operator,
          data: replacementData(
            BigInt(4),
            0,
            1,
            laterProjection,
            "https://example.invalid/movx/inactive.json",
            "https://example.invalid/movx/basic-replacement.json",
          ),
        }),
      ),
    );
    lineageState = await getLineageState(rpcUrl, lineage);
    assert.equal(lineageState.currentMemberWallet, memberTwo.address);
    assert.equal(lineageState.currentAsset, replacementAsset);
    assert.equal(lineageState.generation, 1);
    assert.equal(lineageState.projectionVersion, BigInt(5));
    const inactiveAsset = await getCoreAsset(rpcUrl, firstAsset);
    const activeAsset = await getCoreAsset(rpcUrl, replacementAsset);
    assert.equal(inactiveAsset.owner, memberOne.address);
    assert.equal(inactiveAsset.name, INACTIVE_NAME);
    assert.equal(activeAsset.owner, memberTwo.address);
    assert.equal(activeAsset.name, ACTIVE_NAME);
    assert.equal(activeAsset.updateAuthority, lineage);

    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "historical asset validation",
      assertCurrentInstruction(lineage, firstAsset, 0),
    );
    results.push(
      await sendSuccessfulInstruction(
        rpcUrl,
        feePayer,
        "replacement asset validation",
        assertCurrentInstruction(lineage, replacementAsset, 1),
      ),
    );
    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "replayed wallet replacement",
      replacementInstruction({
        lineage,
        oldAsset: firstAsset,
        newAsset: replacementAsset,
        newMemberWallet: memberTwo.address,
        feePayer,
        operator,
        data: replacementData(
          BigInt(4),
          0,
          1,
          laterProjection,
          "https://example.invalid/movx/inactive-replay.json",
          "https://example.invalid/movx/active-replay.json",
        ),
      }),
    );
    await expectSimulationFailure(
      rpcUrl,
      feePayer,
      "replacement card transfer",
      transferCoreAssetInstruction({
        asset: replacementAsset,
        feePayer,
        owner: memberTwo,
        newOwner: outsider.address,
      }),
    );

    await rpc(rpcUrl, "surfnet_setAccount", [
      failedReplacementAsset,
      {
        lamports: 1_000_000,
        owner: SYSTEM_PROGRAM_ADDRESS,
        executable: false,
      },
    ]);
    const beforeFailedReplacement = await getLineageState(rpcUrl, lineage);
    const beforeFailedAsset = await getCoreAsset(rpcUrl, replacementAsset);
    await submitExpectedFailure(
      rpcUrl,
      feePayer,
      "replacement CPI rollback",
      replacementInstruction({
        lineage,
        oldAsset: replacementAsset,
        newAsset: failedReplacementAsset,
        newMemberWallet: outsider.address,
        feePayer,
        operator,
        data: replacementData(
          BigInt(5),
          1,
          2,
          laterProjection,
          "https://example.invalid/movx/rollback-inactive.json",
          "https://example.invalid/movx/rollback-active.json",
        ),
      }),
    );
    const afterFailedReplacement = await getLineageState(rpcUrl, lineage);
    const afterFailedAsset = await getCoreAsset(rpcUrl, replacementAsset);
    assert.deepEqual(afterFailedReplacement, beforeFailedReplacement);
    assert.deepEqual(afterFailedAsset, beforeFailedAsset);

    const measuredUnits = results
      .map((result) => result.unitsConsumed)
      .filter((value): value is number => value !== null);
    console.log(
      JSON.stringify(
        {
          status: "passed",
          cluster: "local Surfpool fork of Solana Devnet",
          program: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
          coreProgram: MPL_CORE_ADDRESS,
          lineage,
          activeAsset: replacementAsset,
          historicalAsset: firstAsset,
          successfulTransactions: results.length,
          maxUnitsConsumed:
            measuredUnits.length > 0 ? Math.max(...measuredUnits) : null,
          assertions: [
            "initial creation",
            "current-card validation",
            "same-asset usage update",
            "replay rejection",
            "expiry rejection",
            "same-wallet period reuse",
            "permanent-freeze transfer rejection",
            "operator authorization",
            "sponsor role separation",
            "atomic wallet replacement",
            "inactive predecessor rejection",
            "failed-CPI rollback",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await stopSurfpool(surfpool);
  }
}

await run();
