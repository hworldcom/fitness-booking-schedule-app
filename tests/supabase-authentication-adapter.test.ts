import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  createSupabaseAuthenticationAdapter,
  supabaseAuthenticationFailure,
} from "../src/auth/client/supabase-auth-adapter";
import { createAuthenticationGateway } from "../src/auth/gateway";

const subject = "91d0f7c0-472f-44dd-8a94-ae06857348f2";
const email = "adapter@example.test";

function fixture() {
  let next: { body: unknown; status: number } = { body: {}, status: 200 };
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const client = createClient("http://127.0.0.1:54321", "public-test-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        calls.push({
          path: new URL(String(input)).pathname + new URL(String(input)).search,
          body: init?.body ? JSON.parse(String(init.body)) : {},
        });
        return new Response(JSON.stringify(next.body), {
          status: next.status,
          headers: {
            "content-type": "application/json",
            "x-supabase-api-version": "2024-01-01",
          },
        });
      },
    },
  });
  const gateway = createAuthenticationGateway(
    createSupabaseAuthenticationAdapter(() => client),
    async () => ({
      status: "signed-in",
      subject,
      email,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return {
    gateway,
    calls,
    respond: (body: unknown, status = 200) => {
      next = { body, status };
    },
  };
}

function session() {
  const now = Math.floor(Date.now() / 1000);
  const part = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  return {
    access_token: `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: subject, exp: now + 3600, iat: now })}.test-signature`,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: subject,
      aud: "authenticated",
      email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

test("installed SDK adapter sends existing-only OTP by default and preserves password bytes", async () => {
  const { gateway, calls, respond } = fixture();
  assert.deepEqual(await gateway.requestEmailCode(email), {
    status: "requested",
  });
  assert.equal(calls[0].path, "/auth/v1/otp");
  assert.equal(calls[0].body.create_user, false);
  respond(session());
  const password = "  keep 😀 spaces  ";
  assert.deepEqual(await gateway.signInWithPassword(email, password), {
    status: "success",
    email,
  });
  assert.equal(calls[1].path, "/auth/v1/token?grant_type=password");
  assert.equal(calls[1].body.password, password);
  assert.equal(calls[1].body.email, email);
  respond({});
  assert.deepEqual(await gateway.signOut(), { status: "success", email: null });
  assert.equal(calls.at(-1)?.path, "/auth/v1/logout?scope=local");
});

test("signup acknowledges new and duplicate addresses without exporting SDK identities", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const { gateway, calls, respond } = fixture();
  respond({ id: subject, email });
  assert.deepEqual(await gateway.registerWithPassword(email, "abcdefgh"), {
    status: "requested",
  });
  assert.equal(
    calls[0].path,
    "/auth/v1/signup?redirect_to=http%3A%2F%2Flocalhost%3A3100%2Fauth%2Fconfirm",
  );
  assert.equal(calls[0].body.password, "abcdefgh");
  respond({ code: "user_already_exists", msg: "private account details" }, 422);
  assert.deepEqual(await gateway.registerWithPassword(email, "abcdefgh"), {
    status: "requested",
  });
});

test("auto-confirming signup fails closed and clears the resulting local session", async () => {
  const { gateway, calls, respond } = fixture();
  respond(session());
  assert.deepEqual(await gateway.registerWithPassword(email, "abcdefgh"), {
    status: "unavailable",
  });
  assert.equal(calls.at(-1)?.path, "/auth/v1/logout?scope=local");
});

test("provider codes map to bounded application failures without raw messages", () => {
  for (const code of [
    "invalid_credentials",
    "email_not_confirmed",
    "user_banned",
  ]) {
    assert.deepEqual(
      supabaseAuthenticationFailure(
        { code, status: 400, message: "secret email/password" },
        "password",
      ),
      { status: "invalid-credentials" },
    );
  }
  assert.deepEqual(
    supabaseAuthenticationFailure(
      { code: "otp_expired", status: 403 },
      "verify-code",
    ),
    { status: "invalid-proof" },
  );
  assert.deepEqual(supabaseAuthenticationFailure({ status: 429 }, "register"), {
    status: "rate-limited",
    retryAfterSeconds: null,
  });
  assert.deepEqual(
    supabaseAuthenticationFailure(
      {
        code: "weak_password",
        status: 422,
        message: "private provider details",
      },
      "register",
    ),
    { status: "invalid", message: "password-unsafe" },
  );
  assert.deepEqual(
    supabaseAuthenticationFailure(
      { status: 503, message: "private request" },
      "password",
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    supabaseAuthenticationFailure(new Error("private request"), "verify-code"),
    { status: "unavailable" },
  );
  assert.deepEqual(
    supabaseAuthenticationFailure(
      { code: "user_not_found", status: 400 },
      "request-code",
    ),
    { status: "requested" },
  );
});
