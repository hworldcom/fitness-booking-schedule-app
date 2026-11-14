import assert from "node:assert/strict";
import test from "node:test";
import { calendarCommand } from "@/calendar/connection";
import { parseCalendarConfig } from "@/server/google-calendar/config";
import {
  googleCalendarProvider,
  CalendarProviderError,
} from "@/server/google-calendar/provider";
import { calendarConnectionService } from "@/server/google-calendar/service";
import { seal } from "@/server/google-calendar/crypto";
import type { CalendarRecord } from "@/server/db/google-calendar/repository";

const env = {
  MOVX_GOOGLE_CALENDAR_ENABLED: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  MOVX_GOOGLE_CALENDAR_CLIENT_ID: "fixture.apps.googleusercontent.com",
  MOVX_GOOGLE_CALENDAR_CLIENT_SECRET: "fixture-secret",
  MOVX_GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const config = parseCalendarConfig(env)!;
const generation = "11111111-1111-4111-8111-111111111111",
  commandId = "22222222-2222-4222-8222-222222222222";

test("Calendar deletion requires explicit command identity and rejects injected targets", () => {
  const input = { action: "delete", generation, commandId };
  assert.deepEqual(calendarCommand(input), input);
  for (const invalid of [
    { action: "delete", generation },
    { ...input, calendarId: "other-calendar" },
    { ...input, profileId: generation },
    { ...input, confirmed: true },
  ])
    assert.equal(calendarCommand(invalid), null);
});
test("Environment names are fixed and new calendars receive the correct title", async () => {
  for (const [origin, name] of [
    ["http://localhost:3100", "MovX (Local)"],
    ["https://uat.movx.club", "MovX (UAT)"],
    ["https://movx.club", "MovX"],
    ["https://preview.example.test", "MovX (Test)"],
  ]) {
    const c = parseCalendarConfig({ ...env, NEXT_PUBLIC_SITE_URL: origin })!;
    assert.equal(c.calendarName, name);
    const provider = googleCalendarProvider(c, async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        summary: name,
        timeZone: "Europe/Berlin",
      });
      return Response.json({ id: "fixture-calendar" });
    });
    assert.equal(
      await provider.createCalendar("fixture-access"),
      "fixture-calendar",
    );
  }
});
test("Default-only renaming is conditional on the metadata version and preserves custom names", async () => {
  for (const name of ["MovX", "My workouts"]) {
    const calls: { method: string; headers: Headers; body: unknown }[] = [],
      checkpoints: number[] = [];
    const p = googleCalendarProvider(config, async (url, init) => {
      calls.push({
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body,
      });
      if (String(url).includes("/events?"))
        return Response.json({ kind: "calendar#events" });
      return Response.json({
        id: "fixture-calendar",
        summary: name,
        etag: '"version-1"',
      });
    });
    assert.equal(
      await p.calendar("fixture-access", "fixture-calendar", async () => {
        checkpoints.push(calls.length);
      }),
      "fixture-calendar",
    );
    const patch = calls.find((c) => c.method === "PATCH");
    if (name === "MovX") {
      assert.ok(patch);
      assert.equal(patch.headers.get("if-match"), '"version-1"');
      assert.deepEqual(JSON.parse(String(patch.body)), {
        summary: "MovX (Local)",
      });
      assert.deepEqual(checkpoints, [1, 2]);
    } else {
      assert.equal(patch, undefined);
      assert.deepEqual(checkpoints, [1]);
    }
  }
});
test("A fresh authority fence or concurrent custom rename prevents metadata overwrite", async () => {
  for (const failAt of ["checkpoint", "etag"]) {
    let patches = 0,
      checks = 0;
    const p = googleCalendarProvider(config, async (url, init) => {
      if (init?.method === "PATCH") {
        patches++;
        return new Response(null, { status: 412 });
      }
      if (String(url).includes("/events?"))
        return Response.json({ kind: "calendar#events" });
      return Response.json({
        id: "fixture-calendar",
        summary: "MovX",
        etag: '"old"',
      });
    });
    await assert.rejects(
      p.calendar("fixture-access", "fixture-calendar", async () => {
        checks++;
        if (failAt === "checkpoint" && checks === 2)
          throw Error("stale session");
      }),
    );
    assert.equal(patches, failAt === "checkpoint" ? 0 : 1);
  }
});
test("DELETE accepts an empty successful response and never treats missing/failed/unknown outcomes as success", async () => {
  for (const status of [204, 404, 410, 401, 500]) {
    let calls = 0;
    const p = googleCalendarProvider(config, async (url, init) => {
      calls++;
      assert.equal(
        String(url),
        "https://www.googleapis.com/calendar/v3/calendars/fixture-calendar",
      );
      assert.equal(init?.method, "DELETE");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.body, undefined);
      return new Response(null, { status });
    });
    if (status === 204)
      await p.deleteCalendar("fixture-access", "fixture-calendar");
    else
      await assert.rejects(
        p.deleteCalendar("fixture-access", "fixture-calendar"),
        CalendarProviderError,
      );
    assert.equal(calls, 1);
    await assert.rejects(p.deleteCalendar("fixture-access", "primary"));
    assert.equal(calls, 1);
  }
});
test("Deletion pins the repository target, checkpoints before DELETE and never automatically retries", async () => {
  for (const outcome of ["success", "fence", "timeout", "missing"]) {
    const ctx = {
      profileId: "fixture-profile",
      runId: "fixture-run",
      subject: "fixture-subject",
      sessionId: generation,
    };
    const c: CalendarRecord = {
      generation,
      state: "connecting",
      previous_state: "connected",
      google_sub: "google-1",
      google_email: "owner@example.test",
      client_hash: config.clientHash,
      operation_id: commandId,
      credential_ciphertext: seal(
        "fixture-refresh",
        `movx-calendar:v1:${ctx.runId}:${ctx.profileId}:refresh`,
        config.keys,
      ),
    };
    const operations: string[] = [];
    const p = googleCalendarProvider(config, async (url, init) => {
      if (String(url).endsWith("/token")) {
        operations.push("refresh");
        return Response.json({
          access_token: "fixture-access",
          token_type: "Bearer",
        });
      }
      if (init?.method === "DELETE") {
        operations.push("DELETE");
        if (outcome === "timeout") throw Error("sensitive provider message");
        return new Response(null, {
          status: outcome === "missing" ? 404 : 204,
        });
      }
      assert.equal(init?.method, undefined);
      return String(url).includes("/events?")
        ? Response.json({ kind: "calendar#events" })
        : Response.json({
            id: "pinned-calendar",
            summary: "MovX",
            etag: '"1"',
          });
    });
    const s = calendarConnectionService({
      config,
      provider: p,
      context: async () => ctx,
      cookie: { read: async () => null, write: async () => {} },
      command: async (_ctx, action, _gen, input) => {
        operations.push(action);
        if (action === "delete-claim") {
          assert.equal(input.clientHash, config.clientHash);
          return { kind: "ok", record: c, calendarId: "pinned-calendar" };
        }
        if (action === "delete-dispatch" && outcome === "fence")
          return { kind: "conflict" };
        return { kind: "ok", record: c };
      },
    });
    const run = s.run({ action: "delete", generation, commandId });
    if (outcome === "success") await run;
    else
      await assert.rejects(
        run,
        (e) => (e as { status: string }).status === "delete-uncertain",
      );
    assert.equal(
      operations.filter((x) => x === "DELETE").length,
      outcome === "fence" ? 0 : 1,
    );
    assert.ok(
      operations.indexOf("delete-claim") < operations.indexOf("refresh"),
    );
    if (outcome !== "fence")
      assert.ok(
        operations.indexOf("delete-dispatch") < operations.indexOf("DELETE"),
      );
    assert.equal(
      operations.at(-1),
      outcome === "success" ? "delete-confirm" : "delete-fail",
    );
  }
});
