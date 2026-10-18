import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createMissingDemoAccounts,
  provisionDemoCoaches,
} from "../scripts/lib/provision-demo-coaches";
import { demoRetirementArgument } from "../scripts/lib/demo-coach-retirement";
import { privateDemoCredentialStore } from "../scripts/lib/demo-coach-credentials";

test("all hosted demo flags refuse before accessing a CLI, target or private journal", async () => {
  for (const environment of ["dev", "prod", "staging"]) {
    for (const flags of [
      [],
      ["--check"],
      ["--publish-urls"],
      ["--publish-urls", "--check"],
    ]) {
      await assert.rejects(
        provisionDemoCoaches(["--environment", environment, ...flags]),
        /local-only/,
      );
    }
  }
  const commands = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  for (const name of ["demo:setup:dev", "demo:urls:dev"])
    assert.ok(
      !commands[name].includes("--env-file"),
      "obsolete aliases must not load hosted credentials before refusing",
    );
});

test("direct missing-account helper cannot bypass local-only policy", async () => {
  let calls = 0;
  const forbidden = async () => {
    calls++;
    throw new Error("Unexpected write");
  };
  await assert.rejects(
    createMissingDemoAccounts({
      users: [],
      environment: "dev",
      auth: {
        auth: { admin: { createUser: forbidden, updateUserById: forbidden } },
      } as unknown as Parameters<typeof createMissingDemoAccounts>[0]["auth"],
      query: forbidden,
      openStore: forbidden,
    }),
    /local-only/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    privateDemoCredentialStore("/unreachable-no-write", "dev", "forbidden"),
    /local-only/,
  );
});

test("retirement needs exact dev selection and explicit check or apply; local/production are refused", () => {
  assert.equal(
    demoRetirementArgument(["--environment", "dev", "--check"]),
    false,
  );
  assert.equal(
    demoRetirementArgument(["--environment", "dev", "--apply"]),
    true,
  );
  for (const args of [
    [],
    ["--environment", "dev"],
    ["--environment", "local", "--apply"],
    ["--environment", "prod", "--apply"],
    ["--environment", "dev", "--apply", "--check"],
  ])
    assert.throws(() => demoRetirementArgument(args));
});
