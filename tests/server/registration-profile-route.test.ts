import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/auth/identity/route";

test("profile completion rejects incomplete or forged input before Auth/database access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "profile-public-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  for (const body of [
    "{broken",
    "x".repeat(2049),
    JSON.stringify({ displayName: "Alex" }),
    JSON.stringify({ username: "alex", fullName: "", displayName: "Alex" }),
    JSON.stringify({
      username: "alex",
      fullName: "Alex Example",
      displayName: "Alex",
      role: "coach",
    }),
  ]) {
    const response = await POST(
      new Request("http://localhost:3100/api/auth/identity", {
        method: "POST",
        headers: {
          origin: "http://localhost:3100",
          "content-type": "application/json",
        },
        body,
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { status: "invalid" });
  }
});
