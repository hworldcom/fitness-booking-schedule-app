import assert from "node:assert/strict";
import test from "node:test";
import { verifiedDatabaseFingerprints } from "../scripts/lib/database-fingerprints.mjs";

test("preservation checks reject the historical equal-NULL-hash failure, empty snapshots and malformed evidence", () => {
  for (const snapshot of [
    "null",
    "{}",
    "[]",
    "invalid",
    '{"app.profiles":null}',
    '{"app.profiles":""}',
    '{"app.profiles":"not-a-hash"}',
    '{"app.profiles":123}',
    '{"profiles":"d751713988987e9331980363e24189ce"}',
  ])
    assert.throws(
      () => verifiedDatabaseFingerprints(snapshot),
      /fingerprints are invalid/,
    );
});
test("valid table hashes preserve exact snapshot equality and detect changed row contents", () => {
  const before =
    '{"app.profiles":"d751713988987e9331980363e24189ce","auth.users":"d751713988987e9331980363e24189ce"}';
  const after = before.replace(
    "d751713988987e9331980363e24189ce",
    "c4ca4238a0b923820dcc509a6f75849b",
  );
  assert.equal(verifiedDatabaseFingerprints(before), before);
  assert.notEqual(
    verifiedDatabaseFingerprints(after),
    verifiedDatabaseFingerprints(before),
  );
});
