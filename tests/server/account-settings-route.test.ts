import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/account/route";

test("account writes reject cross-origin, malformed, oversized and authority-bearing input before accessing private data", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    "account-settings-public-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const headers = {
    origin: "http://localhost:3100",
    "content-type": "application/json",
  };
  const cases = [
    {
      headers: { ...headers, origin: "https://outside.example.test" },
      body: "{}",
      code: 403,
      status: "forbidden",
    },
    {
      headers: { ...headers, "content-type": "text/plain" },
      body: "{}",
      code: 400,
      status: "invalid",
    },
    { headers, body: "{broken", code: 400, status: "invalid" },
    { headers, body: "x".repeat(2049), code: 400, status: "invalid" },
    {
      headers,
      body: new Uint8Array([0xff, 0xff]),
      code: 400,
      status: "invalid",
    },
    {
      headers,
      body: JSON.stringify({
        displayName: "Settings Test",
        birthdate: null,
        gender: null,
        revision: 0,
        profileId: "someone-else",
      }),
      code: 400,
      status: "invalid",
    },
  ];
  for (const scenario of cases) {
    const response = await POST(
      new Request("http://localhost:3100/api/account", {
        method: "POST",
        headers: scenario.headers,
        body: scenario.body,
      }),
    );
    assert.equal(response.status, scenario.code);
    assert.deepEqual(await response.json(), { status: scenario.status });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
  }
});
