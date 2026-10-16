import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const privateValue = "CALENDAR_INTEGRATION_PRIVATE_VALUE_NEVER_PRINT";
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  NODE_ENV: "test",
  DATABASE_URL: privateValue,
  NEXT_PUBLIC_SUPABASE_URL: privateValue,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: privateValue,
  NEXT_PUBLIC_SITE_URL: privateValue,
};

test("importing the shared rehearsal does not select a target, start fixtures or run its CLI", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const m = await import('./scripts/rehearse-hosted-coach-availability.mjs'); if (typeof m.runHostedAvailability !== 'function') process.exit(2);",
    ],
    { env, encoding: "utf8", timeout: 15_000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, "");
});

test("integrated rehearsal refuses unsafe targets, partial scenarios and missing private configuration before fixtures", () => {
  for (const args of [
    [],
    ["--environment", "production", "--run"],
    ["--environment", "staging", "--run"],
    ["--environment", "dev", "--reset"],
    ["--environment", "dev", "--run", "extra"],
    ["--environment", "dev", "--check"],
    ["--environment", "dev", "--run", "--scenario", "public-access"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/rehearse-hosted-calendar-integration.mjs", ...args],
      { env, encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, args.join(" "));
    const output = result.stdout + result.stderr;
    assert.ok(!output.includes(privateValue) && !output.includes("PASS"));
    assert.match(
      output,
      /Select hosted dev explicitly|Use --environment|Hosted database\/Auth configuration|complete integration rehearsal/,
    );
  }
});
