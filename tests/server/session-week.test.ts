import assert from "node:assert/strict";
import test from "node:test";
import { publicScheduleSelection } from "@/domain/public-coach-schedule";
import { typedSessionWeekRecord } from "@/server/db/coaches/typed-session-repository";
import type { DatabaseConnection } from "@/server/db/client";
import { GET } from "@/app/api/coaches/[slug]/session-types/route";

const id = "40000000-0000-4000-8000-000000000001";
const now = "2026-10-24T22:30:00.000Z";
test("a weekly read uses the database clock, one bounded availability statement and closes its connection", async () => {
  for (const date of ["2026-10-25", "2026-11-23", "2026-10-24", "2027-01-01"]) {
    let statements = 0,
      closed = 0;
    const dates = publicScheduleSelection(date, now).dates;
    const connection = {
      db: {
        execute: async () =>
          ++statements === 1
            ? [{ reference_time: now }]
            : dates.map((day) => ({ date: day, times: [] })),
      },
      queryClient: {
        end: async () => {
          closed++;
        },
      },
    } as unknown as DatabaseConnection;
    const result = await typedSessionWeekRecord(
      "fixture-coach",
      id,
      id,
      date,
      connection,
    );
    assert.deepEqual(
      result.days.map((day) => day.date),
      dates,
    );
    assert.equal(
      result.resetToCurrent,
      date < "2026-10-25" || date > "2026-11-23",
    );
    assert.equal(statements, 2);
    assert.equal(closed, 1);
  }
});
test("missing/malformed days or a query failure cannot become a ready empty week and always close", async () => {
  for (const outcome of [
    null,
    [],
    [{ date: "2026-10-25", times: "broken" }],
    "throw",
  ]) {
    let statements = 0,
      closed = 0;
    const connection = {
      db: {
        execute: async () => {
          if (++statements === 1) return [{ reference_time: now }];
          if (outcome === "throw") throw new Error("Database unavailable");
          return outcome;
        },
      },
      queryClient: {
        end: async () => {
          closed++;
        },
      },
    } as unknown as DatabaseConnection;
    await assert.rejects(
      typedSessionWeekRecord("fixture-coach", id, id, "2026-10-25", connection),
    );
    assert.equal(closed, 1);
  }
});
test("weekly API denies preview detail reads, rejects invalid/ambiguous input and never shares caching", async () => {
  const keys = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;
  const original = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    for (const [query, status] of [
      [`typeId=${id}&locationId=${id}&weekOf=2026-10-25`, 403],
      [`typeId=${id}&locationId=${id}&weekOf=2026-02-30`, 400],
      [`typeId=invalid&locationId=${id}&weekOf=2026-10-25`, 400],
      [`typeId=${id}&locationId=${id}&weekOf=2026-10-25&date=2026-10-26`, 400],
      [
        `typeId=${id}&locationId=${id}&weekOf=2026-10-25&weekOf=2026-10-26`,
        400,
      ],
    ] as const) {
      const response = await GET(
        new Request(
          `http://localhost/api/coaches/fixture-coach/session-types?${query}`,
        ),
        { params: Promise.resolve({ slug: "fixture-coach" }) },
      );
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("vary"), "Cookie");
      const body = await response.json();
      assert.equal("week" in body, false);
      assert.equal("times" in body, false);
    }
  } finally {
    keys.forEach((key, i) => {
      if (original[i] === undefined) delete process.env[key];
      else process.env[key] = original[i];
    });
  }
});
