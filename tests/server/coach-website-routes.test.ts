import assert from "node:assert/strict";
import test from "node:test";
import { PUT } from "@/app/api/coach/website/route";
import { POST, DELETE } from "@/app/api/coach/website/banner/route";
import { boundedRequestBody } from "@/server/http/bounded-body";

test("website mutation routes reject forged origins/schema/revision and bounded bodies before database access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  for (const [method, body, extra] of [
    ["PUT", "{bad", {}],
    [
      "PUT",
      JSON.stringify({ schemaVersion: 9, expectedRevision: 0, content: {} }),
      {},
    ],
    ["PUT", "x".repeat(65537), {}],
    ["POST", "bytes", { "content-type": "image/svg+xml", "if-match": '"0"' }],
    ["POST", "bytes", { "content-type": "image/png" }],
    ["DELETE", undefined, { "if-match": "*" }],
  ] as const) {
    const request = new Request("http://localhost:3100/api/coach/website", {
      method,
      headers: {
        origin: "http://localhost:3100",
        "content-type": "application/json",
        ...extra,
      },
      body,
    });
    const response = await (
      method === "PUT" ? PUT : method === "POST" ? POST : DELETE
    )(request);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { status: "invalid" });
  }
  assert.equal(
    (
      await PUT(
        new Request("http://localhost:3100/api/coach/website", {
          method: "PUT",
          headers: {
            origin: "https://forged.test",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      )
    ).status,
    400,
  );
});
test("actual streamed limits apply without Content-Length and cancel oversized bodies", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5));
      controller.enqueue(new Uint8Array(5));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  assert.equal(await boundedRequestBody(request, 9), null);
  assert.equal(cancelled, true);
  assert.deepEqual(
    await boundedRequestBody(
      new Request("http://localhost", { method: "POST", body: "okay" }),
      4,
    ),
    new TextEncoder().encode("okay"),
  );
});
