import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  acceptRecoveryProof,
  type RecoveryPorts,
} from "@/server/auth/recovery";
import { authenticationProviderFailure } from "@/server/auth/provider-failure";
import { authenticationResultMessage } from "@/auth/gateway";
import { isAuthenticationResult } from "@/auth/operations";

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const command = { flow: "a".repeat(64), tokenHash: "b".repeat(64) };
function fixture(overrides: Partial<RecoveryPorts> = {}) {
  const calls: string[] = [];
  const verified = {
    status: "verified" as const,
    subject: "subject",
    sessionId: "new-session",
    email: "owner@example.test",
    async publish() {
      calls.push("publish");
      return true;
    },
    async discard() {
      calls.push("discard");
    },
  };
  const ports: RecoveryPorts = {
    async read(id) {
      assert.equal(id, hash(command.flow));
      calls.push("read");
      return {
        purpose: "recovery",
        emailHash: hash(verified.email),
        returnTo: "/invitations",
        intent: "coach",
      };
    },
    async verify(token) {
      assert.equal(token, command.tokenHash);
      calls.push("verify");
      return verified;
    },
    async consume(id, email) {
      assert.equal(id, hash(command.flow));
      assert.equal(email, hash(verified.email));
      calls.push("consume");
      return true;
    },
    async grant(proof, flow) {
      assert.equal(proof, verified);
      assert.equal(flow.purpose, "recovery");
      assert.equal(flow.returnTo, "/invitations");
      calls.push("grant-recovery");
      return true;
    },
    async revoke(proof) {
      assert.equal(proof, verified);
      calls.push("revoke-new-session");
    },
    async retirePrevious() {
      calls.push("retire-previous");
    },
    ...overrides,
  };
  return { calls, ports, verified };
}

test("portable recovery verifies email and consumes active flow before adopting any cookies", async () => {
  const f = fixture();
  assert.deepEqual(
    await acceptRecoveryProof(command, { status: "signed-out" }, f.ports),
    { status: "recovery-required", next: "/reset-password" },
  );
  assert.deepEqual(f.calls, [
    "read",
    "verify",
    "consume",
    "grant-recovery",
    "publish",
    "retire-previous",
  ]);
});

test("different signed-in account and uncertain session are preserved before token exchange", async () => {
  const f = fixture();
  assert.deepEqual(
    await acceptRecoveryProof(
      command,
      {
        status: "signed-in",
        subject: "other",
        email: "other@example.test",
        expiresAt: null,
      },
      f.ports,
    ),
    { status: "invalid", message: "recovery-account-conflict" },
  );
  assert.deepEqual(f.calls, ["read"]);
  f.calls.length = 0;
  assert.deepEqual(
    await acceptRecoveryProof(command, { status: "unavailable" }, f.ports),
    { status: "unavailable" },
  );
  assert.deepEqual(f.calls, []);
});

test("expired/superseded/signup flows cannot invoke provider or adopt authority", async () => {
  for (const flow of [
    null,
    {
      purpose: "confirmation" as const,
      emailHash: hash("owner@example.test"),
      returnTo: "/",
      intent: null,
    },
  ]) {
    const f = fixture({ read: async () => flow });
    assert.deepEqual(
      await acceptRecoveryProof(command, { status: "signed-out" }, f.ports),
      { status: "invalid-proof" },
    );
    assert.deepEqual(f.calls, []);
  }
});

test("wrong email, replay and uncertain grant revoke only the new isolated session", async () => {
  for (const scenario of [
    "wrong-email",
    "replayed",
    "grant-failed",
    "grant-uncertain",
    "publish-failed",
  ]) {
    const f = fixture();
    if (scenario === "wrong-email")
      f.verified.email = "someone-else@example.test";
    // Keep the server flow bound to the original mailbox independently of the proof.
    f.ports = {
      ...f.ports,
      read: async () => ({
        purpose: "recovery",
        emailHash: hash("owner@example.test"),
        returnTo: "/",
        intent: null,
      }),
    };
    if (scenario === "replayed")
      f.ports = { ...f.ports, consume: async () => false };
    if (scenario === "grant-failed")
      f.ports = { ...f.ports, grant: async () => false };
    if (scenario === "grant-uncertain")
      f.ports = {
        ...f.ports,
        grant: async () => {
          throw Error("unknown write outcome");
        },
      };
    if (scenario === "publish-failed") f.verified.publish = async () => false;
    const result = await acceptRecoveryProof(
      command,
      { status: "signed-out" },
      f.ports,
    );
    assert.equal(
      result.status,
      ["wrong-email", "replayed"].includes(scenario)
        ? "invalid-proof"
        : "unavailable",
    );
    assert.ok(f.calls.includes("revoke-new-session"));
    assert.ok(f.calls.includes("discard"));
    assert.ok(!f.calls.includes("retire-previous"));
    if (scenario !== "publish-failed") assert.ok(!f.calls.includes("publish"));
  }
});

test("provider outages, rate limits and unexpected success never become ordinary authority", async () => {
  for (const result of [
    { status: "unavailable" as const },
    { status: "rate-limited" as const, retryAfterSeconds: 60 },
    { status: "success" as const, email: "owner@example.test" },
  ]) {
    const f = fixture({ verify: async () => result });
    const actual = await acceptRecoveryProof(
      command,
      { status: "signed-out" },
      f.ports,
    );
    assert.deepEqual(
      actual,
      result.status === "success" ? { status: "unavailable" } : result,
    );
    assert.deepEqual(f.calls, ["read"]);
  }
});

test("a published recovery session survives a failed retirement read for retry", async () => {
  const f = fixture({
    retirePrevious: async () => {
      throw Error("temporary DB failure");
    },
  });
  assert.deepEqual(
    await acceptRecoveryProof(command, { status: "signed-out" }, f.ports),
    { status: "recovery-required", next: "/reset-password" },
  );
  assert.ok(!f.calls.includes("discard"));
});

test("password reuse, bad login and real outages have distinct closed results", () => {
  const reuse = authenticationProviderFailure(
    { code: "same_password", status: 422 },
    "update",
  );
  assert.deepEqual(reuse, { status: "invalid", message: "password-unchanged" });
  assert.equal(isAuthenticationResult(reuse), true);
  assert.match(
    authenticationResultMessage(reuse),
    /different from your current password/,
  );
  assert.deepEqual(
    authenticationProviderFailure(
      { code: "invalid_credentials", status: 400 },
      "password",
    ),
    { status: "invalid-credentials" },
  );
  assert.deepEqual(
    authenticationProviderFailure(
      { code: "same_password", status: 503 },
      "update",
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(authenticationProviderFailure({ status: 503 }, "password"), {
    status: "unavailable",
  });
  assert.deepEqual(
    authenticationProviderFailure(
      { code: "same_password", status: 422 },
      "password",
    ),
    { status: "unavailable" },
  );
  assert.equal(
    isAuthenticationResult({
      status: "invalid",
      message: "recovery-account-conflict",
    }),
    true,
  );
});
