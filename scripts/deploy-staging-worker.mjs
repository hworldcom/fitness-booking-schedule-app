import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedSiteUrl = "https://staging.movx.club";
const expectedSupabaseHost = "qaluvzwudsqrchdwxcsb.supabase.co";
const expectedDatabaseUser = "movx_staging_runtime_login";
const expectedWorkerName = "movx-club-staging";
const approvedBindings = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "DATABASE_URL",
  "SOLANA_CLUSTER",
  "NEXT_PUBLIC_SOLANA_RPC_URL",
  "SOLANA_RPC_URL",
  "SOLANA_FEE_SPONSOR_ADDRESS",
  "SOLANA_FEE_SPONSOR_KEYPAIR_BASE64",
];

function fail(message) {
  throw new Error(`Staging deployment validation failed: ${message}`);
}

function requiredValue(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is missing.`);
  return value;
}

function validatedEnvironment() {
  const values = Object.fromEntries(
    approvedBindings.map((name) => [name, requiredValue(name)]),
  );

  if (values.NEXT_PUBLIC_SITE_URL !== expectedSiteUrl) {
    fail(`NEXT_PUBLIC_SITE_URL must be ${expectedSiteUrl}.`);
  }

  if (values.SOLANA_CLUSTER !== "devnet") {
    fail("SOLANA_CLUSTER must be devnet for the hackathon activation flow.");
  }
  for (const name of ["NEXT_PUBLIC_SOLANA_RPC_URL", "SOLANA_RPC_URL"]) {
    let rpcUrl;
    try {
      rpcUrl = new URL(values[name]);
    } catch {
      fail(`${name} is not a valid URL.`);
    }
    if (rpcUrl.protocol !== "https:") {
      fail(`${name} must use HTTPS in staging.`);
    }
  }
  if (
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(values.SOLANA_FEE_SPONSOR_ADDRESS)
  ) {
    fail("SOLANA_FEE_SPONSOR_ADDRESS must be a base58 Solana address.");
  }
  let sponsorKeypair;
  try {
    sponsorKeypair = Buffer.from(
      values.SOLANA_FEE_SPONSOR_KEYPAIR_BASE64,
      "base64",
    );
  } catch {
    fail("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 must be valid base64.");
  }
  if (sponsorKeypair.length !== 64) {
    sponsorKeypair.fill(0);
    fail("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 must decode to 64 bytes.");
  }
  sponsorKeypair.fill(0);

  let supabaseUrl;
  try {
    supabaseUrl = new URL(values.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (
    supabaseUrl.protocol !== "https:" ||
    supabaseUrl.hostname !== expectedSupabaseHost ||
    supabaseUrl.pathname !== "/" ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    fail(`NEXT_PUBLIC_SUPABASE_URL must target ${expectedSupabaseHost}.`);
  }
  if (
    !values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")
  ) {
    fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(values.DATABASE_URL);
  } catch {
    fail("DATABASE_URL is not a valid URL.");
  }
  const databaseUser = decodeURIComponent(databaseUrl.username).split(".")[0];
  if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) {
    fail("DATABASE_URL must use PostgreSQL.");
  }
  if (
    databaseUser !== expectedDatabaseUser ||
    databaseUrl.port !== "6543" ||
    !databaseUrl.hostname.endsWith(".pooler.supabase.com") ||
    !databaseUrl.password
  ) {
    fail(
      `DATABASE_URL must use the ${expectedDatabaseUser} transaction-pooler login on port 6543.`,
    );
  }
  if (["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
    fail("DATABASE_URL cannot target a loopback host.");
  }

  const wranglerSource = readFileSync(
    path.join(root, "wrangler.jsonc"),
    "utf8",
  );
  if (!wranglerSource.includes(`"name": "${expectedWorkerName}"`)) {
    fail(`wrangler.jsonc must target only ${expectedWorkerName}.`);
  }
  if (/"routes?"\s*:|"custom_domains?"\s*:/.test(wranglerSource)) {
    fail(
      "wrangler.jsonc must not bind a route or custom domain before rehearsal.",
    );
  }

  return values;
}

function binary(name) {
  return path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: options.capture ? "utf8" : undefined,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`${path.basename(command)} exited with status ${result.status}.`);
  }
  return result.stdout?.trim() ?? "";
}

function requireCleanDeploymentCommit() {
  const status = run("git", ["status", "--porcelain=v1"], { capture: true });
  if (status) {
    fail("the worktree must be clean before a real deployment.");
  }
  return run("git", ["rev-parse", "--short=12", "HEAD"], { capture: true });
}

const mode = process.argv[2] ?? "--dry-run";
if (!["--validate-only", "--dry-run", "--deploy"].includes(mode)) {
  fail("use --validate-only, --dry-run or --deploy.");
}

let temporaryDirectory;
try {
  const values = validatedEnvironment();
  console.log(
    `Validated ${expectedWorkerName} configuration and ${approvedBindings.length} approved bindings without printing values.`,
  );

  if (mode === "--validate-only") process.exit(0);

  const commit = mode === "--deploy" ? requireCleanDeploymentCommit() : null;
  run(binary("vinext"), ["build"]);

  temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), "movx-club-staging-deploy-"),
  );
  const secretsFile = path.join(temporaryDirectory, "secrets.json");
  writeFileSync(secretsFile, JSON.stringify(values), { mode: 0o600 });
  if ((statSync(secretsFile).mode & 0o077) !== 0) {
    fail("the temporary secrets file is not owner-only.");
  }

  const deployArguments = [
    "deploy",
    "--config",
    path.join(root, "dist", "server", "wrangler.json"),
    "--secrets-file",
    secretsFile,
  ];
  if (mode === "--dry-run") deployArguments.push("--dry-run");
  run(binary("wrangler"), deployArguments);

  console.log(
    mode === "--deploy"
      ? `Deployed ${expectedWorkerName} from commit ${commit}.`
      : `Completed the ${expectedWorkerName} deployment dry run.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unknown deployment error.",
  );
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
