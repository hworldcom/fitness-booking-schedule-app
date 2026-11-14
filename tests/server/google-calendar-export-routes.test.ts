import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/account/google-calendar/export/route";
import { GET as dispatch } from "@/app/api/internal/google-calendar/dispatch/route";

test("Booking-export routes reject cross-origin, oversized and target-bearing commands before actor/database access", async () => {
  const before = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  try {
    const input = {
      action: "enable",
      version: "00000000-0000-0000-0000-000000000000",
      generation: "00000000-0000-0000-0000-000000000000",
      commandId: "11111111-1111-4111-8111-111111111111",
    };
    for (const [origin, body, code] of [
      ["https://outside.example.test", JSON.stringify(input), 403],
      ["http://localhost:3100", "{invalid", 400],
      ["http://localhost:3100", "x".repeat(4097), 400],
      [
        "http://localhost:3100",
        JSON.stringify({ ...input, profileId: "another-owner" }),
        400,
      ],
      [
        "http://localhost:3100",
        JSON.stringify({ ...input, calendarId: "primary" }),
        400,
      ],
      [
        "http://localhost:3100",
        JSON.stringify({ ...input, action: "repair" }),
        400,
      ],
    ] as const) {
      const result = await POST(
        new Request(
          "http://localhost:3100/api/account/google-calendar/export",
          {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body,
          },
        ),
      );
      assert.equal(result.status, code);
      assert.equal(result.headers.get("cache-control"), "private, no-store");
      assert.equal(result.headers.get("vary"), "Cookie");
      assert.deepEqual(Object.keys(await result.json()), ["status"]);
    }
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = before;
  }
});

test("Calendar cron requires its server credential and never falls back to browser or owner authority", async () => {
  const before = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    const missing = await dispatch(
      new Request(
        "http://localhost:3100/api/internal/google-calendar/dispatch",
      ),
    );
    assert.equal(missing.status, 503);
    assert.deepEqual(await missing.json(), { status: "unavailable" });
    process.env.CRON_SECRET = "fixture-calendar-cron-secret-32-or-more";
    for (const authorization of [
      "",
      "Bearer short",
      "Bearer fixture-calendar-cron-secret-32-or-morf",
    ]) {
      const result = await dispatch(
        new Request(
          "http://localhost:3100/api/internal/google-calendar/dispatch",
          {
            headers: {
              authorization,
              cookie: "fixture-session=not-worker-authority",
            },
          },
        ),
      );
      assert.equal(result.status, 401);
      assert.equal(result.headers.get("cache-control"), "no-store");
      assert.deepEqual(await result.json(), { status: "unauthorized" });
    }
  } finally {
    if (before === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = before;
  }
});
