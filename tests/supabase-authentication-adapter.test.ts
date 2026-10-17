import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseAuthenticationAdapter } from "../src/auth/client/supabase-auth-adapter";
import { postAuthenticationCommand } from "../src/auth/client/operation-client";
import type { AuthenticationCommand } from "../src/auth/operations";

test("browser adapter sends closed application commands instead of calling credential SDK methods", async () => {
  const calls: AuthenticationCommand[] = [];
  const adapter = createSupabaseAuthenticationAdapter(
    () => {
      throw new Error("No credential SDK access allowed");
    },
    async (command) => {
      calls.push(command);
      return command.action === "register"
        ? { status: "requested" }
        : { status: "success", email: null };
    },
  );
  await adapter.registerWithPassword(
    "existing@example.test",
    "  keep spaces  ",
  );
  await adapter.signInWithPassword("existing@example.test", "old123");
  await adapter.signOut();
  assert.deepEqual(calls, [
    {
      action: "register",
      email: "existing@example.test",
      password: "  keep spaces  ",
    },
    { action: "sign-in", email: "existing@example.test", password: "old123" },
    { action: "sign-out" },
  ]);
});

test("HTTP Auth transport rejects malformed/private replies and keeps secrets in POST bodies", async (t) => {
  const request = {
    action: "sign-in",
    email: "transport@example.test",
    password: "  keep spaces  ",
  } as const;
  let next: unknown = {
    status: "success",
    email: request.email,
    next: "/sessions",
  };
  let code = 200;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/auth/operations");
      assert.equal(options.method, "POST");
      assert.equal(options.cache, "no-store");
      assert.equal(options.credentials, "same-origin");
      assert.deepEqual(JSON.parse(String(options.body)), request);
      return Response.json(next, { status: code });
    },
  );
  assert.deepEqual(await postAuthenticationCommand(request), next);
  for (const invalid of [
    { status: "success", email: request.email, access_token: "private" },
    { status: "success", email: request.email, next: "//outside.example" },
    { status: "rate-limited", retryAfterSeconds: -1 },
    { status: "unknown", message: "private provider details" },
  ]) {
    next = invalid;
    assert.deepEqual(await postAuthenticationCommand(request), {
      status: "unavailable",
    });
  }
  next = { status: "success", email: request.email };
  code = 503;
  assert.deepEqual(await postAuthenticationCommand(request), {
    status: "unavailable",
  });
});
