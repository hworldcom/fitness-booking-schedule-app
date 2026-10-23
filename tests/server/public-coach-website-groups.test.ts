import assert from "node:assert/strict";
import test from "node:test";
import { loadCoachPublicGroups } from "@/server/coaches/public-website-groups";
import type { GroupSession } from "@/domain/group-sessions";

const group = (slug: string, id: string) =>
  ({ id, coach: { slug } }) as GroupSession;
test("coach groups match exact coach across public pages, never global or prefix matches", async () => {
  let calls = 0;
  const result = await loadCoachPublicGroups("mine", async (after) => {
    calls++;
    return after
      ? { items: [group("mine", "second")], nextCursor: null }
      : {
          items: [group("mine-other", "foreign"), group("mine", "first")],
          nextCursor: { at: "2026-10-20T00:00:00Z", id: "cursor" },
        };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, {
    status: "ready",
    sessions: [group("mine", "first"), group("mine", "second")],
  });
});
test("coach groups deduplicate in public order and stop after six exact matches", async () => {
  let calls = 0;
  const result = await loadCoachPublicGroups("mine", async (after) => {
    calls++;
    if (!after)
      return {
        items: [group("mine", "first"), group("mine-other", "foreign")],
        nextCursor: { at: "2026-10-20T00:00:00Z", id: "cursor" },
      };
    return {
      items: [
        group("mine", "first"),
        ...Array.from({ length: 7 }, (_, i) => group("mine", `next-${i}`)),
      ],
      nextCursor: { at: "2026-10-21T00:00:00Z", id: "unread" },
    };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, {
    status: "ready",
    sessions: [
      group("mine", "first"),
      ...Array.from({ length: 5 }, (_, i) => group("mine", `next-${i}`)),
    ],
  });
});
test("only an exhausted successful scan is verified empty; partial reads never become success", async () => {
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => ({
      items: [group("another", "foreign")],
      nextCursor: null,
    })),
    { status: "ready", sessions: [] },
  );
  for (const failure of ["missing", "throw"] as const) {
    let calls = 0;
    const result = await loadCoachPublicGroups("mine", async (after) => {
      calls++;
      if (!after)
        return {
          items: [group("mine", "partial")],
          nextCursor: { at: "2026-10-20T00:00:00Z", id: "cursor" },
        };
      if (failure === "throw") throw Error("offline");
      return null;
    });
    assert.equal(calls, 2);
    assert.deepEqual(result, { status: "unavailable" });
  }
});
test("group failed, repeated-cursor and bounded-incomplete reads cannot claim no groups", async () => {
  assert.deepEqual(await loadCoachPublicGroups("mine", async () => null), {
    status: "unavailable",
  });
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => {
      throw Error("offline");
    }),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => ({
      items: [],
      nextCursor: { at: "now", id: "same" },
    })),
    { status: "unavailable" },
  );
  let calls = 0;
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => ({
      items: [],
      nextCursor: { at: "now", id: String(++calls) },
    })),
    { status: "unavailable" },
  );
  assert.equal(calls, 20);
});
