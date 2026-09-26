import assert from "node:assert/strict";
import test from "node:test";
import {
  isMembershipActivationFailureReason,
  normalizeMembershipActivationId,
  normalizeMembershipActivationSelection,
  normalizeMembershipPaymentAddress,
  normalizeMembershipPaymentBaseUnits,
  normalizeMembershipTransactionSignature,
} from "@/domain/membership-activation";

const operationId = "96000000-0000-4000-8000-000000000001";
const walletAddress = "11111111111111111111111111111111";
const transactionSignature = "2".repeat(88);

test("activation input requires one v4 operation id and four distinct gym slugs", () => {
  assert.equal(normalizeMembershipActivationId(operationId), operationId);
  assert.equal(
    normalizeMembershipActivationId("96000000-0000-3000-8000-000000000001"),
    null,
  );

  assert.deepEqual(
    normalizeMembershipActivationSelection({
      planId: "basic",
      gymIds: ["northside-combat", "fabrik", "vela", "groundline-mma"],
    }),
    {
      planId: "basic",
      gymIds: ["northside-combat", "fabrik", "vela", "groundline-mma"],
    },
  );

  for (const gymIds of [
    ["northside-combat"],
    ["northside-combat", "fabrik", "vela", "vela"],
    ["northside-combat", "fabrik", "vela", "Not A Slug"],
  ]) {
    assert.equal(
      normalizeMembershipActivationSelection({ planId: "basic", gymIds }),
      null,
    );
  }
  assert.equal(
    normalizeMembershipActivationSelection({
      planId: "legacy-plan",
      gymIds: ["one", "two", "three", "four"],
    }),
    null,
  );
});

test("payment evidence is bounded to Devnet-compatible address, signature and u64 shapes", () => {
  assert.equal(normalizeMembershipPaymentAddress(walletAddress), walletAddress);
  assert.equal(normalizeMembershipPaymentAddress("0invalid"), null);
  assert.equal(
    normalizeMembershipTransactionSignature(transactionSignature),
    transactionSignature,
  );
  assert.equal(normalizeMembershipTransactionSignature("short"), null);
  assert.equal(normalizeMembershipPaymentBaseUnits("80000000"), "80000000");
  assert.equal(normalizeMembershipPaymentBaseUnits("0"), null);
  assert.equal(
    normalizeMembershipPaymentBaseUnits("18446744073709551616"),
    null,
  );
});

test("only bounded activation failure reasons are accepted", () => {
  for (const reason of [
    "wallet-cancelled",
    "transaction-rejected",
    "verification-failed",
    "superseded",
  ]) {
    assert.equal(isMembershipActivationFailureReason(reason), true);
  }
  assert.equal(isMembershipActivationFailureReason("payment-refunded"), false);
});
