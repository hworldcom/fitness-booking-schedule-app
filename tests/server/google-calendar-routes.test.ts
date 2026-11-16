import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/account/google-calendar/route";
import { POST as start } from "@/app/auth/google-calendar/start/route";
import { calendarRedirect } from "@/server/google-calendar/http";
import { GET as callback } from "@/app/auth/google-calendar/callback/route";

test("Calendar route writes reject foreign, malformed, oversized and actor-bearing input before authorization", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const headers = {
    origin: "http://localhost:3100",
    "content-type": "application/json",
  };
  for (const [extra, body, code] of [
    [{ origin: "https://outside.example.test" }, "{}", 403],
    [{ "content-type": "text/plain" }, "{}", 400],
    [{}, "{broken", 400],
    [{}, "x".repeat(4097), 400],
    [
      {},
      JSON.stringify({
        action: "disconnect",
        generation: "00000000-0000-0000-0000-000000000000",
        profileId: "someone-else",
      }),
      400,
    ],
    [
      {},
      JSON.stringify({
        action: "replace",
        generation: "00000000-0000-0000-0000-000000000000",
      }),
      400,
    ],
  ] as const) {
    const r = await POST(
      new Request("http://localhost:3100/api/account/google-calendar", {
        method: "POST",
        headers: { ...headers, ...extra },
        body,
      }),
    );
    assert.equal(r.status, code);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(r.headers.get("vary"), "Cookie");
  }
  const r = await start(
    new Request("http://localhost:3100/auth/google-calendar/start", {
      method: "POST",
      headers: { origin: "https://outside.example.test" },
      body: "generation=bad",
    }),
  );
  assert.equal(r.status, 403);
  for (const body of [
    "generation=bad",
    "generation=00000000-0000-0000-0000-000000000000&intent=enable",
    "generation=00000000-0000-0000-0000-000000000000&intent=sync&intent=sync",
    "generation=00000000-0000-0000-0000-000000000000&intent=sync&version=00000000-0000-0000-0000-000000000000",
    `generation=00000000-0000-0000-0000-000000000000&profileId=other`,
    `generation=00000000-0000-0000-0000-000000000000&generation=00000000-0000-0000-0000-000000000000`,
  ]) {
    const invalid = await start(
      new Request("http://localhost:3100/auth/google-calendar/start", {
        method: "POST",
        headers: {
          origin: "http://localhost:3100",
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      }),
    );
    assert.equal(invalid.status, 400);
  }
  const redirect = calendarRedirect(
    "/account?section=connected-calendars&calendar=denied",
  );
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("referrer-policy"), "no-referrer");
  assert.ok(!redirect.headers.get("location")!.includes("code="));
  const sanitized = await callback(
    new Request(
      "http://localhost:3100/auth/google-calendar/callback?code=private-fixture-proof&state=invalid&error_description=private-fixture-description",
    ),
  );
  assert.equal(sanitized.status, 303);
  assert.ok(!sanitized.headers.get("location")!.includes("private-fixture"));
});
