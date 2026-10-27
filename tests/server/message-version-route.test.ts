import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "@/app/api/messages/route";
import { MESSAGE_VERSION_HEADER } from "@/messages/version";

test("unsupported Messages versions fail before Auth/database access and retain private headers", async () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "message-test-public-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  try {
    for (const version of ["0", "3", "02", "2,1"]) {
      const headers = {
        [MESSAGE_VERSION_HEADER]: version,
        origin: "http://localhost:3100",
        "content-type": "application/json",
      };
      for (const response of [
        await GET(
          new Request("http://localhost:3100/api/messages", { headers }),
        ),
        await POST(
          new Request("http://localhost:3100/api/messages", {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "read",
              args: {
                conversationId: "ae013100-0000-4000-8000-000000000001",
                through: 1,
              },
            }),
          }),
        ),
      ]) {
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { status: "invalid" });
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
        assert.equal(response.headers.get("vary"), "Cookie");
      }
    }
  } finally {
    for (const key of keys)
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
  }
});
