import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/coach/public-url/route";
test("public URL confirmation rejects missing consent, forged ownership, invalid bodies and cross-origin writes before authority", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const valid = { username: "coach_amy", expectedRevision: 1, consent: true };
  for (const body of [
    "{broken",
    "x".repeat(1025),
    JSON.stringify({ ...valid, consent: false }),
    JSON.stringify({ ...valid, username: "Coach_amy" }),
    JSON.stringify({ ...valid, expectedRevision: -1 }),
    JSON.stringify({ ...valid, profileId: "forged" }),
  ]) {
    const result = await POST(
      new Request("http://localhost:3100/api/coach/public-url", {
        method: "POST",
        headers: {
          origin: "http://localhost:3100",
          "content-type": "application/json",
        },
        body,
      }),
    );
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { status: "invalid" });
    assert.equal(result.headers.get("cache-control"), "private, no-store");
  }
  for (const origin of ["https://evil.test", "null", ""]) {
    const result = await POST(
      new Request("http://localhost:3100/api/coach/public-url", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(valid),
      }),
    );
    assert.equal(result.status, 400);
  }
});
