import assert from "node:assert/strict";
import test from "node:test";
import type {
  ConnectionCursor,
  ConnectionProjection,
} from "@/domain/coach-athlete-connections";
import { countIncomingConnectionPages } from "@/server/connections/pending-count";
import { currentConnectionPendingCount } from "@/server/connections/service";
import { GET } from "@/app/api/connections/pending-count/route";

const rows = Array.from(
  { length: 121 },
  (_, id) => ({ id: String(id), status: "pending" }) as ConnectionProjection,
);
const cursor = (id: string) => ({
  id,
  createdAt: "2026-11-08T12:00:00.123456Z",
});

test("pending connection count includes every incoming page, deduplicates overlapping rows and distinguishes empty", async () => {
  const seen: (ConnectionCursor | null)[] = [];
  const count = await countIncomingConnectionPages(async (before) => {
    seen.push(before);
    return !before
      ? { items: rows.slice(0, 50), nextCursor: cursor("49") }
      : before.id === "49"
        ? { items: rows.slice(49, 99), nextCursor: cursor("98") }
        : { items: rows.slice(99), nextCursor: null };
  });
  assert.equal(count, 121);
  assert.deepEqual(seen, [null, cursor("49"), cursor("98")]);
  assert.equal(
    await countIncomingConnectionPages(async () => ({
      items: [],
      nextCursor: null,
    })),
    0,
  );
});

test("partial failure, nonpending rows and cyclic cursor reads cannot produce a verified count", async () => {
  await assert.rejects(
    countIncomingConnectionPages(async (before) => {
      if (before) throw Error("unavailable");
      return { items: rows.slice(0, 50), nextCursor: cursor("49") };
    }),
  );
  await assert.rejects(
    countIncomingConnectionPages(async () => ({
      items: [{ ...rows[0], status: "accepted" }],
      nextCursor: null,
    })),
  );
  for (const cycle of [false, true]) {
    let reads = 0;
    await assert.rejects(
      countIncomingConnectionPages(async () => ({
        items: rows.slice(0, 1),
        nextCursor: cursor(cycle && ++reads % 2 === 0 ? "two" : "one"),
      })),
    );
  }
});

test("count service rejects forged roles and malformed expected owners before identity/database reads", async () => {
  for (const [role, owner] of [
    ["operator", "owner"],
    ["coach", null],
    ["athlete", {}],
    ["athlete", "forged"],
  ]) {
    assert.deepEqual(await currentConnectionPendingCount(role, owner), {
      status: "invalid",
    });
  }
});

test("private count route rejects missing/duplicate roles and forged owners without caching data", async () => {
  for (const query of [
    "",
    "?role=coach&role=athlete",
    "?role=operator",
    "?role=athlete",
  ]) {
    const response = await GET(
      new Request(`http://localhost/api/connections/pending-count${query}`, {
        headers: { "X-MovX-Connection-Owner": "forged" },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary") ?? "", /Cookie/);
    assert.deepEqual(await response.json(), { status: "invalid" });
  }
});
