import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAuthenticationCommand,
  isAuthenticationResult,
} from "@/auth/operations";
import { safeReturnTo } from "@/auth/return-to";

test("authentication accepts only bounded application commands without caller-owned authority", () => {
  const command = {
    action: "sign-in",
    email: "athlete@example.test",
    password: " exact secret ",
    returnTo: "/sessions?section=requests",
    intent: "coach",
  };
  assert.deepEqual(parseAuthenticationCommand(command), command);
  for (const extra of [
    { subject: "other" },
    { provider: "google" },
    { purpose: "ordinary" },
    { role: "coach" },
    { metadata: {} },
    { access_token: "private" },
  ])
    assert.equal(parseAuthenticationCommand({ ...command, ...extra }), null);
  for (const value of [
    null,
    [],
    { action: "__proto__" },
    { action: "sign-out", email: "x" },
    { ...command, password: 7 },
    { ...command, intent: "admin" },
    { ...command, returnTo: "x".repeat(2049) },
  ])
    assert.equal(parseAuthenticationCommand(value), null);
  const proof = {
    action: "confirm-email",
    flow: "a".repeat(64),
    tokenHash: "b".repeat(64),
    type: "recovery",
  };
  assert.deepEqual(parseAuthenticationCommand(proof), proof);
  assert.equal(
    parseAuthenticationCommand({ ...proof, type: "email_change" }),
    null,
  );
  assert.equal(
    parseAuthenticationCommand({ ...proof, tokenHash: "secret in URL?" }),
    null,
  );
});

test("authentication results cannot smuggle provider credentials or unbounded errors", () => {
  for (const result of [
    { status: "success", email: null },
    { status: "requested" },
    { status: "recovery-required", next: "/reset-password" },
    { status: "rate-limited", retryAfterSeconds: null },
  ])
    assert.equal(isAuthenticationResult(result), true);
  for (const result of [
    { status: "success", email: null, refresh_token: "secret" },
    { status: "unavailable", message: "private provider response" },
    { status: "success", email: null, next: "//outside.test" },
    { status: "recovery-required" },
    { status: "rate-limited", retryAfterSeconds: -1 },
    { status: "invalid", message: "anything" },
  ])
    assert.equal(isAuthenticationResult(result), false);
});

test("authentication continuation rejects encoded entry loops and privileged routes", () => {
  for (const target of [
    "/auth/confirm",
    "/%61uth/confirm",
    "/%2561uth/confirm",
    "/x/../register",
    "/api/auth/operations",
    "/_next/a",
    "/forgot-password?returnTo=/sessions",
    "/\\outside.test",
    "//outside.test",
  ])
    assert.equal(safeReturnTo(target, "https://movx.club"), "/", target);
  for (const target of [
    "/sessions?section=requests",
    "/messages?conversationId=opaque",
    "/invite/opaque#details",
  ])
    assert.equal(safeReturnTo(target, "https://movx.club"), target);
});
