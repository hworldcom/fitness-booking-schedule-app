import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseConnection } from "@/server/db/client";
import { typedPrivateScheduleSummaryRecord } from "@/server/db/coaches/private-schedule-summary-repository";
import { publicPrivateScheduleSummary } from "@/server/coaches/private-schedule-summary-service";
import { privateScheduleSummary } from "@/domain/private-schedule-summary";
import { GET } from "@/app/api/coaches/[slug]/session-types/route";

test("summary repository returns only a validated aggregate and always closes its connection", async () => {
  for (const count of [0, 25, "25", -1, 701, null]) {
    let closed = 0;
    const connection = {
      db: {
        execute: async () =>
          Array.from({ length: 7 }, (_, index) => ({
            date: `2026-10-${19 + index}`,
            open_slots: index === 0 ? count : 0,
            private_times: ["not public"],
          })),
      },
      queryClient: {
        end: async () => {
          closed++;
        },
      },
    } as unknown as DatabaseConnection;
    const result = typedPrivateScheduleSummaryRecord(
      "fixture-coach",
      connection,
    );
    if (typeof count === "number" && count >= 0 && count <= 700)
      assert.deepEqual(
        await result,
        privateScheduleSummary(
          Array.from({ length: 7 }, (_, index) => ({
            date: `2026-10-${19 + index}`,
            count: index === 0 ? count : 0,
          })),
        ),
      );
    else await assert.rejects(result);
    assert.equal(closed, 1);
  }
});
test("catalog failure does not invent zero or reopen legacy inventory", async () => {
  assert.deepEqual(
    await publicPrivateScheduleSummary(
      "fixture-coach",
      null,
      [],
      "2026-10-19T08:00:00Z",
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await publicPrivateScheduleSummary(
      "fixture-coach",
      { enabled: false, types: [], locations: [] },
      [],
      "2026-10-19T08:00:00Z",
    ),
    privateScheduleSummary(
      Array.from({ length: 7 }, (_, index) => ({
        date: `2026-10-${19 + index}`,
        count: 0,
      })),
    ),
  );
});
test("preview mode cannot read individual times and responses prohibit shared caching", async () => {
  const keys = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;
  const original = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    const id = "40000000-0000-4000-8000-000000000001";
    const result = await GET(
      new Request(
        `http://localhost/api/coaches/fixture-coach/session-types?typeId=${id}&locationId=${id}&date=2026-10-19`,
      ),
      { params: Promise.resolve({ slug: "fixture-coach" }) },
    );
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), { status: "forbidden" });
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(result.headers.get("vary"), "Cookie");
  } finally {
    keys.forEach((key, i) => {
      if (original[i] === undefined) delete process.env[key];
      else process.env[key] = original[i];
    });
  }
});
