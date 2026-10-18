import assert from "node:assert/strict";
import test from "node:test";
import { POST, GET } from "@/app/api/coach-reviews/route";
import { POST as MODERATE } from "@/app/api/coach-reviews/moderation/route";
import { GET as PUBLIC } from "@/app/api/coaches/[slug]/reviews/route";
import {
  decodeReviewCursor,
  encodeReviewCursor,
} from "@/server/db/coaches/review-repository";

test("review write HTTP boundaries reject unsafe requests before actor/database entry", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "review-public-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  for (const route of [POST, MODERATE])
    for (const [body, origin, type] of [
      ["{}", "https://other.example", "application/json"],
      ["{}", "http://localhost:3100", "text/plain"],
      ["{bad", "http://localhost:3100", "application/json"],
      ["x".repeat(16385), "http://localhost:3100", "application/json"],
      [
        JSON.stringify({ action: "publish", athleteId: "forged" }),
        "http://localhost:3100",
        "application/json",
      ],
    ]) {
      const response = await route(
        new Request("http://localhost:3100/api/coach-reviews", {
          method: "POST",
          headers: { origin, "content-type": type },
          body,
        }),
      );
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { status: "invalid" });
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  const badUtf8 = await POST(
    new Request("http://localhost:3100/api/coach-reviews", {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        "content-type": "application/json",
      },
      body: new Uint8Array([255]),
    }),
  );
  assert.equal(badUtf8.status, 400);
});
test("review read query boundaries and cursors reject forged or repeated state", async () => {
  for (const url of [
    "http://localhost:3100/api/coach-reviews",
    "http://localhost:3100/api/coach-reviews?coach=a&coach=b",
    "http://localhost:3100/api/coach-reviews?coach=a&profileId=forged",
  ])
    assert.equal((await GET(new Request(url))).status, 400);
  for (const query of [
    "?cursor=bad",
    "?cursor=a&cursor=b",
    "?profileId=forged",
  ]) {
    const result = await PUBLIC(
      new Request(
        "http://localhost:3100/api/coaches/daniel-park/reviews" + query,
      ),
      { params: Promise.resolve({ slug: "daniel-park" }) },
    );
    assert.equal(result.status, 400);
  }
  const position = {
    createdAt: "2026-10-18T12:00:00.123456+00:00",
    id: "93140000-0000-4000-8000-000000000001",
  };
  assert.deepEqual(decodeReviewCursor(encodeReviewCursor(position)), position);
  assert.equal(decodeReviewCursor(null), null);
  for (const cursor of [
    "x".repeat(201),
    "bad",
    Buffer.from(JSON.stringify({ ...position, athleteId: "private" })).toString(
      "base64url",
    ),
    encodeReviewCursor({ ...position, createdAt: "invalid" }),
    encodeReviewCursor({ ...position, createdAt: "2026-02-30T12:00:00Z" }),
  ])
    assert.equal(decodeReviewCursor(cursor), undefined);
});
