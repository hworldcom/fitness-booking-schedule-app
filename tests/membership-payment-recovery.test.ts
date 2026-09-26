import assert from "node:assert/strict";
import test from "node:test";
import {
  membershipPaymentRecoveryKey,
  parseMembershipPaymentRecovery,
  readMembershipPaymentRecovery,
  writeMembershipPaymentRecovery,
} from "@/features/membership/payment-recovery";

const recovery = Object.freeze({
  operationId: "98000000-0000-4000-8000-000000000101",
  transactionSignature: "2".repeat(88),
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  } as Storage;
}

test("signed membership payment recovery keeps only bounded public evidence", () => {
  assert.deepEqual(
    parseMembershipPaymentRecovery(JSON.stringify(recovery)),
    recovery,
  );
  assert.equal(
    parseMembershipPaymentRecovery(
      JSON.stringify({ ...recovery, destination: "untrusted" }),
    ),
    null,
  );
  assert.equal(
    parseMembershipPaymentRecovery(
      JSON.stringify({ ...recovery, transactionSignature: "not-base58" }),
    ),
    null,
  );
});

test("signed membership payment recovery survives reload and clears explicitly", () => {
  const storage = memoryStorage();
  assert.equal(writeMembershipPaymentRecovery(storage, recovery), true);
  assert.deepEqual(readMembershipPaymentRecovery(storage), recovery);
  assert.ok(storage.getItem(membershipPaymentRecoveryKey));
  assert.equal(writeMembershipPaymentRecovery(storage, null), true);
  assert.equal(readMembershipPaymentRecovery(storage), null);
});
