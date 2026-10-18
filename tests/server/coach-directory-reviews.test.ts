import assert from "node:assert/strict";
import test from "node:test";
import { directoryReviewSummaries } from "@/server/coaches/directory-reviews";

test("directory summaries keep more than 256 matches and deduplicate bounded public batches", async () => {
  const slugs = Array.from({ length: 600 }, (_, i) => `coach-${i}`);
  const calls: number[] = [];
  const result = await directoryReviewSummaries(
    [...slugs, ...slugs],
    async (batch) => {
      calls.push(batch.length);
      return {
        status: "ready",
        summaries: new Map(
          batch.map((slug) => [
            slug,
            { count: 0, mean: null, fictional: false },
          ]),
        ),
      };
    },
  );
  assert.deepEqual(calls, [256, 256, 88]);
  assert.equal(result.size, 600);
  assert.deepEqual(result.get("coach-599"), {
    count: 0,
    mean: null,
    fictional: false,
  });
});

test("failed batches and missing rows never become zero or discard other summaries", async () => {
  const slugs = Array.from({ length: 800 }, (_, i) => `coach-${i}`);
  const result = await directoryReviewSummaries(slugs, async (batch) => {
    if (batch[0] === "coach-0") return { status: "unavailable" };
    if (batch[0] === "coach-256") throw new Error("isolated review outage");
    return {
      status: "ready",
      summaries: new Map([
        [batch[0]!, { count: 2, mean: 4.5, fictional: true }],
        ["unrequested-slug", { count: 10, mean: 5, fictional: false }],
      ]),
    };
  });
  assert.equal(result.size, 2);
  assert.equal(result.has("coach-0"), false);
  assert.equal(result.has("coach-256"), false);
  assert.equal(result.has("coach-513"), false);
  assert.equal(result.has("unrequested-slug"), false);
  assert.equal(result.get("coach-512")?.count, 2);
  assert.equal(result.get("coach-768")?.count, 2);
});

test("an empty directory performs no review read", async () => {
  const result = await directoryReviewSummaries([], async () => {
    throw new Error("unexpected call");
  });
  assert.equal(result.size, 0);
});
