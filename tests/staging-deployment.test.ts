import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/deploy-staging-worker.mjs");
const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://qaluvzwudsqrchdwxcsb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-only",
  NEXT_PUBLIC_SITE_URL: "https://staging.movx.club",
  DATABASE_URL:
    "postgresql://movx_staging_runtime_login.project:test-only@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  SOLANA_CLUSTER: "devnet",
  NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SOLANA_FEE_SPONSOR_ADDRESS: "11111111111111111111111111111111",
  SOLANA_FEE_SPONSOR_KEYPAIR_BASE64: Buffer.alloc(64).toString("base64"),
};

test("staging deployment validation accepts only the staging contract", () => {
  const output = execFileSync(process.execPath, [script, "--validate-only"], {
    cwd: root,
    env: { ...process.env, ...validEnvironment },
    encoding: "utf8",
  });
  assert.match(output, /Validated movx-club-staging configuration/);
  assert.doesNotMatch(output, /sb_publishable_test-only|test-only@/);
});

test("staging deployment validation rejects a non-staging origin", () => {
  const result = spawnSync(process.execPath, [script, "--validate-only"], {
    cwd: root,
    env: {
      ...process.env,
      ...validEnvironment,
      NEXT_PUBLIC_SITE_URL: "https://movx.club",
    },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be https:\/\/staging\.movx\.club/);
  assert.doesNotMatch(result.stderr, /sb_publishable_test-only|test-only@/);
});

test("Wrangler declares exactly the approved staging runtime bindings", () => {
  const wrangler = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "SOLANA_CLUSTER",
    "NEXT_PUBLIC_SOLANA_RPC_URL",
    "SOLANA_RPC_URL",
    "SOLANA_FEE_SPONSOR_ADDRESS",
    "SOLANA_FEE_SPONSOR_KEYPAIR_BASE64",
  ];
  for (const name of names) assert.match(wrangler, new RegExp(`"${name}"`));
  assert.match(wrangler, /"binding":\s*"MOVX_DATABASE"/);
  assert.match(wrangler, /"id":\s*"390007706c314f3f808535332a802f7d"/);
  assert.doesNotMatch(wrangler, /"DATABASE_URL"/);
  assert.doesNotMatch(wrangler, /STAGING_AUTH_TEST|EXPECTED_DATABASE_USER/);
  assert.doesNotMatch(wrangler, /"routes?"\s*:|"custom_domains?"\s*:/);
});
