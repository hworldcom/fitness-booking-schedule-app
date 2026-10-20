import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Explicit loopback DATABASE_TEST_URL required.");
}

test("scheduling rejects missing/repeated local times and preserves timezone compatibility", async () => {
  const db = postgres(url, { max: 1, prepare: false, ssl: false });
  const cases: readonly (readonly [string | null, string | null, boolean])[] = [
    ["2027-03-28 01:59:59", "Europe/Berlin", true],
    ["2027-03-28 02:00:00", "Europe/Berlin", false],
    ["2027-03-28 02:59:59", "Europe/Berlin", false],
    ["2027-03-28 03:00:00", "Europe/Berlin", true],
    ["2026-10-25 01:59:59", "Europe/Berlin", true],
    ["2026-10-25 02:00:00", "Europe/Berlin", false],
    ["2026-10-25 02:30:00.123456", "Europe/Berlin", false],
    ["2026-10-25 02:59:59", "Europe/Berlin", false],
    ["2026-10-25 03:00:00", "Europe/Berlin", true],
    ["2026-10-25 02:30:00", "UTC", true],
    ["2027-03-28 02:30:00", "UTC", true],
    ["2026-11-01 01:30:00", "America/New_York", false],
    ["2027-03-14 02:30:00", "America/New_York", false],
    ["2026-11-01 03:30:00", "America/New_York", true],
    ["2026-04-05 01:45:00", "Australia/Lord_Howe", false],
    ["2026-10-04 02:15:00", "Australia/Lord_Howe", false],
    ["2026-10-04 03:00:00", "Australia/Lord_Howe", true],
    ["2026-10-25 02:30:00", "Asia/Kathmandu", true],
    ["2026-10-25 02:30:00", "not/a-timezone", false],
    ["2026-10-25 02:30:00", "utc", false],
    ["2026-10-25 02:30:00", "", false],
    [null, "Europe/Berlin", false],
    ["2026-10-25 02:30:00", null, false],
    [null, null, false],
  ];
  try {
    for (const [localTime, timezone, expected] of cases) {
      const [row] = await db`
        select app.coach_local_time_is_unambiguous(
          ${localTime}::text::timestamp, ${timezone}::text
        ) as valid
      `;
      assert.equal(row.valid, expected, `${localTime} in ${timezone}`);
    }
  } finally {
    await db.end({ timeout: 5 });
  }
});
