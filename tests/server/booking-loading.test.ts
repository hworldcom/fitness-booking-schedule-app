import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/session-bookings/route";
import { coachSessionBookingPage } from "@/server/coaches/typed-session-service";

test("booking page and slim edit options preserve preview denial and reject invalid cursors before loading", async () => {
  const keys = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    assert.deepEqual(await coachSessionBookingPage("invalid"), {
      status: "invalid",
    });
    assert.deepEqual(
      await coachSessionBookingPage("19700000-0000-4000-8000-000000000001"),
      { status: "forbidden" },
    );
    for (const [query, status] of [
      ["options=edit", 403],
      ["options=1", 403],
      ["options=edit&cursor=null", 400],
      ["options=edit&cursor=broken", 400],
      ["options=1&cursor=broken", 400],
    ] as const) {
      const response = await GET(
        new Request("https://movx.test/api/session-bookings?" + query),
      );
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("vary"), "Cookie");
      const body = await response.json();
      assert.equal("initialBooking" in body, false);
      assert.equal("detail" in body, false);
    }
  } finally {
    keys.forEach((key, index) =>
      previous[index] === undefined
        ? delete process.env[key]
        : (process.env[key] = previous[index]),
    );
  }
});
