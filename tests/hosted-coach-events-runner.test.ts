import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("live coach-event runner refuses implicit writes and non-dev targets before any credential or fixture operation", () => {
  for (const args of [
    [],
    ["--environment", "prod", "--run"],
    ["--environment", "dev"],
    ["--environment", "dev", "--run", "--force"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/rehearse-hosted-coach-events.mjs", ...args],
      {
        encoding: "utf8",
        timeout: 15000,
        env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Select hosted dev explicitly|Use --environment dev --check\|--run/,
    );
    assert.doesNotMatch(
      result.stdout,
      /live rehearsal passed|accounts verified/,
    );
  }
});
