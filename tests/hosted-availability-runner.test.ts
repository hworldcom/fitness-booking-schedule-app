import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("hosted availability runner rejects unsafe selections before fixtures and keeps private configuration out of errors", () => {
  const privateValue = "REHEARSAL_PRIVATE_TRIPWIRE_NEVER_PRINT";
  for (const args of [
    [],
    ["--environment", "production", "--run"],
    ["--environment", "staging", "--run"],
    ["--environment", "dev", "--reset"],
    ["--environment", "dev", "--run", "extra"],
    ["--environment", "dev", "--check"],
    ["--environment", "dev", "--run", "--scenario", "production"],
    ["--environment", "dev", "--run", "--scenario", "inactive-venue"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/rehearse-hosted-coach-availability.mjs", ...args],
      {
        cwd: process.cwd(),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          DATABASE_URL: privateValue,
          NEXT_PUBLIC_SUPABASE_URL: privateValue,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: privateValue,
          NEXT_PUBLIC_SITE_URL: privateValue,
        },
        encoding: "utf8",
        timeout: 15_000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, args.join(" "));
    const output = result.stdout + result.stderr;
    assert.ok(!output.includes(privateValue));
    assert.ok(!output.includes("PASS"));
    assert.match(
      output,
      /Select hosted dev explicitly|Use --environment|Hosted database\/Auth configuration/,
    );
  }
});
