import assert from "node:assert/strict";
import test from "node:test";
import type { GroupSession } from "@/domain/group-sessions";
import { directoryGroupCoachSlugs } from "@/server/coaches/directory-groups";
const group = (slug: string) => ({ coach: { slug } }) as GroupSession;
test("one public page scan deduplicates exact coach slugs across directory results", async () => {
  let calls = 0;
  const result = await directoryGroupCoachSlugs(async (after) => {
    calls++;
    return after
      ? { items: [group("coach-b"), group("coach-a")], nextCursor: null }
      : {
          items: [group("coach-a"), group("coach-a-other")],
          nextCursor: { at: "2026-12-01T10:00:00Z", id: "next" },
        };
  });
  assert.equal(calls, 2);
  assert.deepEqual([...(result ?? [])].sort(), [
    "coach-a",
    "coach-a-other",
    "coach-b",
  ]);
  assert.deepEqual(
    [
      ...(await directoryGroupCoachSlugs(async () => ({
        items: [],
        nextCursor: null,
      })))!,
    ],
    [],
  );
});
test("failed, repeated-cursor and truncated group scans never become verified empty or partial populations", async () => {
  assert.equal(await directoryGroupCoachSlugs(async () => null), null);
  assert.equal(
    await directoryGroupCoachSlugs(async () => {
      throw Error("offline");
    }),
    null,
  );
  assert.equal(
    await directoryGroupCoachSlugs(async () => ({
      items: [group("partial")],
      nextCursor: { at: "same", id: "same" },
    })),
    null,
  );
  let pages = 0;
  assert.equal(
    await directoryGroupCoachSlugs(async () => ({
      items: [group("partial")],
      nextCursor: { at: "next", id: String(++pages) },
    })),
    null,
  );
  assert.equal(pages, 20);
});
