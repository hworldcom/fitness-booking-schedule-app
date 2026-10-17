import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/auth/operations/route";

test("authentication refuses origin, body and authority violations before using credentials or database", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    "operations-public-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const headers = {
    origin: "http://localhost:3100",
    "content-type": "application/json",
  };
  for (const scenario of [
    {
      headers: { ...headers, origin: "https://outside.test" },
      body: "{}",
      code: 403,
    },
    {
      headers: { ...headers, "content-type": "text/plain" },
      body: "{}",
      code: 400,
    },
    { headers, body: "{broken", code: 400 },
    { headers, body: "x".repeat(4097), code: 400 },
    { headers, body: new Uint8Array([255, 255]), code: 400 },
    {
      headers,
      body: JSON.stringify({
        action: "request-code",
        email: "former@example.test",
      }),
      code: 400,
    },
    {
      headers,
      body: JSON.stringify({
        action: "verify-code",
        email: "former@example.test",
        code: "123456",
      }),
      code: 400,
    },
    {
      headers,
      body: JSON.stringify({
        action: "confirm-email",
        flow: "a".repeat(64),
        tokenHash: "b".repeat(64),
        type: "magiclink",
      }),
      code: 400,
    },
    {
      headers,
      body: JSON.stringify({
        action: "reset-password",
        password: "some password",
        subject: "forged",
      }),
      code: 400,
    },
  ]) {
    const response = await POST(
      new Request("http://localhost:3100/api/auth/operations", {
        method: "POST",
        ...scenario,
      }),
    );
    assert.equal(response.status, scenario.code);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.deepEqual(
      await response.json(),
      scenario.code === 403
        ? { status: "forbidden" }
        : { status: "invalid", message: "input" },
    );
  }
});
