import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type AccountMeta,
  type Address,
  type Instruction,
} from "@solana/kit";
import {
  deriveMembershipCardAssetAddress,
  deriveMembershipCardLineageAddress,
  MEMBERSHIP_CARD_PROGRAM_ADDRESS,
} from "../src/solana/membership-card-addresses";

const DEVNET_RPC_URL =
  process.env.MEMBERSHIP_CARD_DEVNET_RPC_URL?.trim() ||
  "https://api.devnet.solana.com";
const OPERATOR_ADDRESS = address(
  process.env.MEMBERSHIP_CARD_OPERATOR_ADDRESS?.trim() ||
    "E9nRXgYvxR3ACYzLtCzBjHuhkgVK9v1M9CrfWCesouWf",
);
const FEE_PAYER_ADDRESS = address(
  process.env.MEMBERSHIP_CARD_FEE_PAYER_ADDRESS?.trim() ||
    "AjrQdXjR9y7B4oniU5TT7PTuiqubySQuvEDJaabkJP8C",
);
const MEMBER_WALLET_ADDRESS = address(
  process.env.MEMBERSHIP_CARD_MEMBER_WALLET?.trim() ||
    "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe",
);
const MPL_CORE_ADDRESS = address(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const METADATA_URI =
  "https://staging.movx.club/membership-card/devnet/basic-active.json";
const LINEAGE_ACCOUNT_DATA_LENGTH = 238;
const RPC_TIMEOUT_MS = 20_000;

type JsonRpcError = Readonly<{
  code: number;
  message: string;
  data?: unknown;
}>;

type RpcAccount = Readonly<{
  data: readonly [string, "base64"];
  executable: boolean;
  lamports: number;
  owner: string;
}>;

class ByteWriter {
  readonly #chunks: Buffer[] = [];

  u8(value: number) {
    const chunk = Buffer.allocUnsafe(1);
    chunk.writeUInt8(value);
    this.#chunks.push(chunk);
    return this;
  }

  u16(value: number) {
    const chunk = Buffer.allocUnsafe(2);
    chunk.writeUInt16LE(value);
    this.#chunks.push(chunk);
    return this;
  }

  i64(value: bigint) {
    const chunk = Buffer.allocUnsafe(8);
    chunk.writeBigInt64LE(value);
    this.#chunks.push(chunk);
    return this;
  }

  bytes(value: Uint8Array) {
    this.#chunks.push(Buffer.from(value));
    return this;
  }

  string(value: string) {
    const encoded = Buffer.from(value, "utf8");
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32LE(encoded.length);
    this.#chunks.push(length, encoded);
    return this;
  }

  finish() {
    return new Uint8Array(Buffer.concat(this.#chunks));
  }
}

function hashFixtureId(label: string) {
  return new Uint8Array(createHash("sha256").update(label).digest());
}

function discriminator(name: string) {
  return new Uint8Array(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function rpc<T>(method: string, params: unknown[] = []) {
  const response = await fetch(DEVNET_RPC_URL, {
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
  if (envelope.error) {
    throw new Error(
      `${method} failed (${envelope.error.code}): ${envelope.error.message}`,
    );
  }
  assert("result" in envelope, `${method} returned no result`);
  return envelope.result as T;
}

async function assertAccountMissing(accountAddress: Address) {
  const response = await rpc<{ value: RpcAccount | null }>("getAccountInfo", [
    accountAddress,
    { commitment: "confirmed", encoding: "base64" },
  ]);
  assert.equal(
    response.value,
    null,
    `Fixture account ${accountAddress} already exists; refusing to prepare a duplicate initialization.`,
  );
}

function assertSimulatedAccount(
  account: RpcAccount | null | undefined,
  expectedOwner: Address,
  expectedDataLength?: number,
) {
  assert(
    account,
    `Simulation did not return the expected ${expectedOwner} account`,
  );
  assert.equal(account.owner, expectedOwner);
  assert.equal(account.executable, false);
  assert(account.lamports > 0);
  assert.equal(account.data[1], "base64");
  if (expectedDataLength !== undefined) {
    assert.equal(
      Buffer.from(account.data[0], "base64").byteLength,
      expectedDataLength,
    );
  }
  return account;
}

async function run() {
  assert.notEqual(
    OPERATOR_ADDRESS,
    FEE_PAYER_ADDRESS,
    "The projection operator and fee payer must be different addresses.",
  );
  assert.equal(
    process.env.SOLANA_CLUSTER?.trim() || "devnet",
    "devnet",
    "This preparation command is restricted to Solana Devnet.",
  );

  const lineageId = hashFixtureId(
    "movx-devnet-membership-card-lineage-2026-09-29-v1",
  );
  const periodProjectionId = hashFixtureId(
    "movx-devnet-membership-card-period-basic-2026-09-29-v1",
  );
  const [lineageAddress] = await deriveMembershipCardLineageAddress(lineageId);
  const [assetAddress] = await deriveMembershipCardAssetAddress(lineageId, 0);

  await Promise.all([
    assertAccountMissing(lineageAddress),
    assertAccountMissing(assetAddress),
  ]);

  const validFrom = BigInt(
    Math.floor(Date.parse("2026-09-29T00:00:00Z") / 1_000),
  );
  const validUntil = BigInt(
    Math.floor(Date.parse("2026-10-29T00:00:00Z") / 1_000),
  );
  const data = new ByteWriter()
    .bytes(discriminator("initialize_membership_card"))
    .bytes(lineageId)
    .bytes(periodProjectionId)
    .u8(0)
    .u8(0)
    .i64(validFrom)
    .i64(validUntil)
    .u16(10)
    .u16(0)
    .u16(10)
    .string(METADATA_URI)
    .finish();
  const instruction: Instruction<string, readonly AccountMeta[]> = {
    programAddress: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    accounts: [
      { address: lineageAddress, role: AccountRole.WRITABLE },
      { address: assetAddress, role: AccountRole.WRITABLE },
      { address: MEMBER_WALLET_ADDRESS, role: AccountRole.READONLY },
      { address: FEE_PAYER_ADDRESS, role: AccountRole.WRITABLE_SIGNER },
      { address: OPERATOR_ADDRESS, role: AccountRole.READONLY_SIGNER },
      { address: MPL_CORE_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };

  const { value: latestBlockhash } = await rpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const message = appendTransactionMessageInstruction(
    instruction,
    setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: blockhash(latestBlockhash.blockhash),
        lastValidBlockHeight: BigInt(latestBlockhash.lastValidBlockHeight),
      },
      setTransactionMessageFeePayer(
        FEE_PAYER_ADDRESS,
        createTransactionMessage({ version: "legacy" }),
      ),
    ),
  );
  const transaction = compileTransaction(message);
  const wireTransaction = getBase64EncodedWireTransaction(transaction);
  const [simulation, fee, feePayerBalance, lineageRent] = await Promise.all([
    rpc<{
      value: {
        accounts: Array<RpcAccount | null> | null;
        err: unknown;
        logs: string[] | null;
        unitsConsumed?: number;
      };
    }>("simulateTransaction", [
      wireTransaction,
      {
        accounts: {
          addresses: [FEE_PAYER_ADDRESS, lineageAddress, assetAddress],
          encoding: "base64",
        },
        commitment: "confirmed",
        encoding: "base64",
        replaceRecentBlockhash: true,
        sigVerify: false,
      },
    ]),
    rpc<{ value: number | null }>("getFeeForMessage", [
      Buffer.from(transaction.messageBytes).toString("base64"),
      { commitment: "confirmed" },
    ]),
    rpc<{ value: number }>("getBalance", [
      FEE_PAYER_ADDRESS,
      { commitment: "confirmed" },
    ]),
    rpc<number>("getMinimumBalanceForRentExemption", [
      LINEAGE_ACCOUNT_DATA_LENGTH,
      { commitment: "confirmed" },
    ]),
  ]);

  if (simulation.value.err !== null) {
    const recentLogs = simulation.value.logs?.slice(-12) ?? [];
    throw new Error(
      `Devnet simulation failed: ${JSON.stringify(simulation.value.err)}\n${recentLogs.join("\n")}`,
    );
  }
  assert(simulation.value.accounts);
  const simulatedFeePayer = assertSimulatedAccount(
    simulation.value.accounts[0],
    SYSTEM_PROGRAM_ADDRESS,
  );
  const simulatedLineage = assertSimulatedAccount(
    simulation.value.accounts[1],
    MEMBERSHIP_CARD_PROGRAM_ADDRESS,
    LINEAGE_ACCOUNT_DATA_LENGTH,
  );
  const simulatedAsset = assertSimulatedAccount(
    simulation.value.accounts[2],
    MPL_CORE_ADDRESS,
  );
  assert.equal(simulatedLineage.lamports, lineageRent);
  const estimatedFee = fee.value;
  if (estimatedFee === null) {
    throw new Error("Devnet did not return a transaction fee");
  }

  const simulatedPayerDelta =
    feePayerBalance.value - simulatedFeePayer.lamports;
  const expectedPayerDelta =
    estimatedFee + simulatedLineage.lamports + simulatedAsset.lamports;
  assert.equal(simulatedPayerDelta, expectedPayerDelta);

  console.log(
    JSON.stringify(
      {
        mode: "simulation-only",
        signed: false,
        sent: false,
        cluster: "devnet",
        program: MEMBERSHIP_CARD_PROGRAM_ADDRESS,
        operator: OPERATOR_ADDRESS,
        feePayer: FEE_PAYER_ADDRESS,
        memberWallet: MEMBER_WALLET_ADDRESS,
        lineage: lineageAddress,
        asset: assetAddress,
        metadataUri: METADATA_URI,
        plan: "Basic",
        status: "Active",
        validFrom: "2026-09-29T00:00:00Z",
        validUntil: "2026-10-29T00:00:00Z",
        visits: { included: 10, used: 0, remaining: 10 },
        simulation: {
          ok: true,
          unitsConsumed: simulation.value.unitsConsumed ?? null,
        },
        estimatedLamports: {
          transactionFee: estimatedFee,
          lineageDeposit: simulatedLineage.lamports,
          assetDeposit: simulatedAsset.lamports,
          totalSponsorDelta: expectedPayerDelta,
          sponsorBalanceBefore: feePayerBalance.value,
        },
      },
      null,
      2,
    ),
  );
}

await run();
