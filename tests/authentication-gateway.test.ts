import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthenticationGateway,
  type AuthenticationAdapter,
  type AuthenticationEvent,
  type AuthenticationResult,
} from "../src/auth/gateway";
import { isSignInPassword, validateNewPassword } from "../src/auth/password";
import type { AuthSessionSnapshot } from "../src/auth/contracts";

function fixture() {
  const calls: unknown[][] = [];
  const listeners = new Set<(event: AuthenticationEvent) => void>();
  let serverSession: AuthSessionSnapshot = {
    status: "signed-in",
    subject: "verified-subject",
    email: "anna@example.com",
    expiresAt: 100,
  };
  let result: AuthenticationResult = {
    status: "success",
    email: "anna@example.com",
  };
  const adapter: AuthenticationAdapter = {
    async execute() {
      return { status: "requested" };
    },
    async registerWithPassword(...args) {
      calls.push(["register", ...args]);
      return { status: "requested" };
    },
    async signInWithPassword(...args) {
      calls.push(["password", ...args]);
      return result;
    },
    async signOut() {
      calls.push(["sign-out"]);
      return { status: "success", email: null };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    gateway: createAuthenticationGateway(adapter, async () => serverSession),
    adapter,
    calls,
    listeners,
    setSession: (session: AuthSessionSnapshot) => {
      serverSession = session;
    },
    setResult: (value: AuthenticationResult) => {
      result = value;
    },
  };
}

test("new passwords use Unicode characters and UTF-8 byte bounds without secret transformation or composition rules", () => {
  for (const password of [
    "abcdefgh",
    "12345678",
    "        ",
    "  keep spaces  ",
    "😀".repeat(8),
    "é".repeat(36),
    "a".repeat(72),
    "e\u0301".repeat(8),
  ]) {
    assert.deepEqual(validateNewPassword(password), { valid: true, password });
  }
  for (const password of ["abcdefg", "😀".repeat(7)]) {
    assert.deepEqual(validateNewPassword(password), {
      valid: false,
      message: "password-too-short",
    });
  }
  for (const password of ["a".repeat(73), "é".repeat(37), "😀".repeat(19)]) {
    assert.deepEqual(validateNewPassword(password), {
      valid: false,
      message: "password-too-long",
    });
  }
  assert.deepEqual(validateNewPassword("aaaaaaa\ud800"), {
    valid: false,
    message: "password-invalid",
  });
  assert.equal(isSignInPassword("old123"), true);
  assert.equal(isSignInPassword(""), false);
  assert.equal(isSignInPassword("a".repeat(73)), false);
});

test("gateway rejects malformed inputs before adapter calls and preserves the exact accepted secret", async () => {
  const { gateway, calls } = fixture();
  assert.equal(
    (await gateway.registerWithPassword("wrong", "abcdefgh")).status,
    "invalid",
  );
  assert.deepEqual(
    await gateway.registerWithPassword("anna@example.com", "seven77"),
    { status: "invalid", message: "password-too-short" },
  );
  assert.equal(
    (await gateway.signInWithPassword("anna@example.com", "")).status,
    "invalid-credentials",
  );
  assert.deepEqual(calls, []);
  const password = "  Ábc 😀 Def  ";
  await gateway.registerWithPassword(" Anna@Example.COM ", password);
  await gateway.signInWithPassword("anna@example.com", "old123");
  assert.deepEqual(calls, [
    ["register", "anna@example.com", password],
    ["password", "anna@example.com", "old123"],
  ]);
});

test("a mismatched verified address never becomes successful login and clears that device", async () => {
  const { gateway, calls, setResult } = fixture();
  setResult({ status: "success", email: "different@example.com" });
  assert.deepEqual(
    await gateway.signInWithPassword("anna@example.com", "abcdefgh"),
    { status: "invalid-credentials" },
  );
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["password", "sign-out"],
  );
});

test("adapter failures cannot leak private transport errors or become fake success", async () => {
  const { gateway, adapter } = fixture();
  adapter.signInWithPassword = async () => {
    throw new Error("private token and password details");
  };
  assert.deepEqual(
    await gateway.signInWithPassword("anna@example.com", "abcdefgh"),
    { status: "unavailable" },
  );
  adapter.signOut = async () => ({
    status: "rate-limited",
    retryAfterSeconds: 60,
  });
  assert.deepEqual(await gateway.signOut(), {
    status: "rate-limited",
    retryAfterSeconds: 60,
  });
});

test("SDK success without matching server verification never reports application sign-in", async () => {
  const { gateway, calls, setSession } = fixture();
  for (const state of [
    { status: "signed-out" },
    { status: "unavailable" },
    {
      status: "signed-in",
      subject: "another-subject",
      email: "someone@example.com",
      expiresAt: 100,
    },
  ] satisfies AuthSessionSnapshot[]) {
    setSession(state);
    assert.deepEqual(
      await gateway.signInWithPassword("anna@example.com", "abcdefgh"),
      { status: "unavailable" },
    );
  }
  assert.equal(calls.filter((call) => call[0] === "sign-out").length, 3);
});

test("subscribers consume application events and unsubscribe through the same boundary", () => {
  const { gateway, listeners } = fixture();
  const events: AuthenticationEvent[] = [];
  const unsubscribe = gateway.subscribe((event) => events.push(event));
  listeners.forEach((listener) => listener("signed-out"));
  unsubscribe();
  listeners.forEach((listener) => listener("session-changed"));
  assert.deepEqual(events, ["signed-out"]);
});
