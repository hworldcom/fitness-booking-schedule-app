import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeCoachPostCursor,
  parseCoachPostCursor,
  validateCoachPostBody,
} from "@/domain/coach-social";

test("coach post text is normalized and bounded", () => {
  assert.deepEqual(validateCoachPostBody("  Balance\n before   speed.  "), {
    valid: true,
    body: "Balance before speed.",
  });
  assert.deepEqual(validateCoachPostBody("  "), {
    valid: false,
    message: "Post text must be between 1 and 500 characters.",
  });
  assert.equal(validateCoachPostBody("x".repeat(501)).valid, false);
});

test("coach post cursors retain the deterministic timestamp and UUID tie-breaker", () => {
  const cursor = encodeCoachPostCursor({
    publishedAt: "2026-10-03T09:30:00.000Z",
    id: "81000000-0000-4000-8000-000000000001",
  });
  assert.deepEqual(parseCoachPostCursor(cursor), {
    publishedAt: "2026-10-03T09:30:00.000Z",
    id: "81000000-0000-4000-8000-000000000001",
  });
  assert.equal(parseCoachPostCursor("not-a-cursor"), null);
  assert.equal(
    parseCoachPostCursor(
      "2026-10-03T09:30:00Z~81000000-0000-4000-8000-000000000001",
    ),
    null,
  );
});
