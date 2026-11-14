import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  calendarExportCommand,
  isCalendarExportResult,
} from "@/calendar/export";
import { parseCalendarConfig } from "@/server/google-calendar/config";
import { seal, unseal } from "@/server/google-calendar/crypto";
import {
  calendarEventProvider,
  CalendarEventError,
  type EventMetadata,
  type ExportTerms,
} from "@/server/google-calendar/events";
import {
  dispatchCalendarExports,
  calendarExportAvailable,
  type ExportRepository,
} from "@/server/google-calendar/export-worker";
import { CalendarProviderError } from "@/server/google-calendar/provider";

const env = {
  MOVX_GOOGLE_CALENDAR_ENABLED: "true",
  DATABASE_URL: "postgresql://runtime:fixture@127.0.0.1:55322/disposable",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  MOVX_GOOGLE_CALENDAR_CLIENT_ID: "export-fixture.apps.googleusercontent.com",
  MOVX_GOOGLE_CALENDAR_CLIENT_SECRET: "fixture-client-secret",
  MOVX_GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64"),
};
const config = parseCalendarConfig(env)!;
const profileId = randomUUID(),
  runId = randomUUID(),
  marker = randomUUID();
const eventId = "m" + randomUUID().replaceAll("-", "");
const calendar = "fixture@group.calendar.google.com";
const terms: ExportTerms = {
  action: "upsert",
  title: "MovX private session",
  startsAt: "2027-03-28T00:30:00.000Z",
  endsAt: "2027-03-28T01:30:00.000Z",
  location: "Permitted venue",
  path: "/sessions/" + randomUUID(),
};
const metadata: EventMetadata = {
  id: eventId,
  etag: '"fixture-version"',
  status: "confirmed",
  marker,
  hasAttendees: false,
};

test("Export commands and status are strictly bounded; rollout requires explicit complete server configuration", () => {
  const input = {
    action: "enable",
    version: randomUUID(),
    generation: randomUUID(),
    commandId: randomUUID(),
  };
  assert.deepEqual(calendarExportCommand(input), input);
  for (const patch of [
    { calendarId: calendar },
    { profileId },
    { action: "unknown" },
    { commandId: null },
  ])
    assert.equal(calendarExportCommand({ ...input, ...patch }), null);
  assert.equal(calendarExportCommand({ ...input, action: "repair" }), null);
  assert.ok(
    calendarExportCommand({ ...input, action: "repair", acknowledged: true }),
  );
  const value = {
    status: "ready",
    available: true,
    generation: randomUUID(),
    connectionState: "connected",
    export: {
      enabled: false,
      version: randomUUID(),
      backfillPending: false,
      pending: 0,
      failed: 0,
      missing: 0,
      issues: [],
      lastSyncedAt: null,
    },
  };
  assert.ok(isCalendarExportResult(value));
  assert.ok(
    !isCalendarExportResult({ ...value, credential: "fixture-private" }),
  );
  assert.ok(
    !isCalendarExportResult({
      ...value,
      export: { ...value.export, issues: ["provider-private-body"] },
    }),
  );
  assert.ok(
    !isCalendarExportResult({
      ...value,
      export: { ...value.export, pending: -1 },
    }),
  );
  assert.equal(calendarExportAvailable(env), false);
  assert.equal(
    calendarExportAvailable({
      ...env,
      MOVX_GOOGLE_CALENDAR_EXPORT_ENABLED: "true",
      GOOGLE_CALENDAR_WORKER_DATABASE_URL: "broken",
    }),
    false,
  );
  assert.equal(
    calendarExportAvailable({
      ...env,
      MOVX_GOOGLE_CALENDAR_EXPORT_ENABLED: "true",
      GOOGLE_CALENDAR_WORKER_DATABASE_URL:
        "postgresql://fixture:fixture@127.0.0.1:55322/disposable",
    }),
    true,
  );
  for (const worker of [
    "postgresql://worker:fixture@127.0.0.1:55322/another_database",
    "postgresql://worker:fixture@elsewhere.test:55322/disposable",
    "postgresql://postgres:fixture@127.0.0.1:55322/disposable",
    "postgresql://runtime:fixture@127.0.0.1:55322/disposable",
  ])
    assert.equal(
      calendarExportAvailable({
        ...env,
        MOVX_GOOGLE_CALENDAR_EXPORT_ENABLED: "true",
        GOOGLE_CALENDAR_WORKER_DATABASE_URL: worker,
      }),
      false,
    );
  const hosted = {
    ...env,
    MOVX_GOOGLE_CALENDAR_EXPORT_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
    DATABASE_URL:
      "postgresql://runtime.fixture:fixture@aws-1-eu.pooler.supabase.com:6543/postgres",
    GOOGLE_CALENDAR_WORKER_DATABASE_URL:
      "postgresql://worker.fixture:fixture@aws-1-eu.pooler.supabase.com:6543/postgres",
  };
  assert.equal(calendarExportAvailable(hosted), true);
  assert.equal(
    calendarExportAvailable({
      ...hosted,
      GOOGLE_CALENDAR_WORKER_DATABASE_URL:
        hosted.GOOGLE_CALENDAR_WORKER_DATABASE_URL.replace(
          "worker.fixture",
          "worker.another",
        ),
    }),
    false,
  );
});

test("Google event writes use the pinned app calendar/ID, minimal private content, exact DST instants and conditional metadata", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = calendarEventProvider(config.siteUrl, async (url, init) => {
    calls.push({ url: String(url), init: init! });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({
      id: eventId,
      status: "confirmed",
      etag: '"fixture-version"',
      extendedProperties: { private: { movxRef: marker } },
    });
  });
  await provider.create("fixture-access", calendar, eventId, marker, terms);
  await provider.update(
    "fixture-access",
    calendar,
    eventId,
    marker,
    {
      ...terms,
      startsAt: "2027-10-31T00:30:00Z",
      endsAt: "2027-10-31T01:30:00Z",
    },
    metadata.etag,
  );
  await provider.remove("fixture-access", calendar, eventId, metadata.etag);
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.id, eventId);
  assert.equal(body.visibility, "private");
  assert.equal(body.start.dateTime, terms.startsAt);
  assert.equal(body.end.dateTime, terms.endsAt);
  assert.equal(body.start.timeZone, "Europe/Berlin");
  assert.equal(body.extendedProperties.private.movxRef, marker);
  assert.deepEqual(
    Object.keys(body).sort(),
    [
      "id",
      "summary",
      "location",
      "description",
      "start",
      "end",
      "visibility",
      "transparency",
      "extendedProperties",
    ].sort(),
  );
  assert.equal(body.attendees, undefined);
  assert.equal(body.summary, "MovX private session");
  assert.equal(
    body.description,
    "View this booking in MovX: " + config.siteUrl + terms.path,
  );
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(
    (calls[1].init.headers as Record<string, string>)["if-match"],
    metadata.etag,
  );
  assert.equal(
    (calls[2].init.headers as Record<string, string>)["if-match"],
    metadata.etag,
  );
  const fall = JSON.parse(String(calls[1].init.body));
  assert.equal(
    Date.parse(fall.end.dateTime) - Date.parse(fall.start.dateTime),
    3600000,
  );
  for (const call of calls) {
    const url = new URL(call.url);
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(url.searchParams.get("sendUpdates"), "none");
    assert.ok(url.pathname.includes(encodeURIComponent(calendar)));
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.cache, "no-store");
  }
  await assert.rejects(
    provider.create("fixture-access", "primary", eventId, marker, terms),
  );
  await assert.rejects(
    provider.create("fixture-access", calendar, "../unrelated", marker, terms),
  );
  await assert.rejects(
    provider.create("fixture-access", calendar, eventId, marker, {
      ...terms,
      path: "//untrusted.invalid",
    }),
  );
  assert.equal(calls.length, 3);
});

test("Provider failure classification is bounded and never exposes Google response content; tombstones need no etag", async () => {
  for (const [status, reason, expected] of [
    [401, "invalid", "authorization-required"],
    [403, "userRateLimitExceeded", "transient"],
    [403, "forbidden", "authorization-required"],
    [404, "notFound", "missing"],
    [410, "deleted", "missing"],
    [409, "duplicate", "transient"],
    [412, "conditionNotMet", "transient"],
    [429, "quota", "transient"],
    [503, "backend", "transient"],
    [400, "invalid", "ownership-conflict"],
  ] as const) {
    const p = calendarEventProvider(config.siteUrl, async () =>
      Response.json(
        { error: { message: "fixture-private-proof", errors: [{ reason }] } },
        { status },
      ),
    );
    await assert.rejects(
      p.get("fixture-access", calendar, eventId),
      (error: unknown) => {
        assert.ok(error instanceof CalendarEventError);
        assert.equal(error.kind, expected);
        assert.ok(!error.message.includes("fixture-private-proof"));
        return true;
      },
    );
  }
  const tombstone = calendarEventProvider(config.siteUrl, async () =>
    Response.json({ id: eventId, status: "cancelled" }),
  );
  assert.equal(
    (await tombstone.get("fixture-access", calendar, eventId)).status,
    "cancelled",
  );
  const oversized = calendarEventProvider(
    config.siteUrl,
    async () => new Response("x".repeat(65537)),
  );
  await assert.rejects(
    oversized.get("fixture-access", calendar, eventId),
    CalendarEventError,
  );
});

function fixture(
  options: {
    missing?: boolean;
    everDelivered?: boolean;
    dispatched?: boolean;
    action?: "delete" | "retain";
    wrongMarker?: boolean;
    guests?: boolean;
    revoked?: boolean;
    missingCalendar?: boolean;
    timeoutAfterCreate?: boolean;
    tombstone?: boolean;
    staleAt?: string;
  } = {},
) {
  const calls: string[] = [],
    outcomes: string[] = [];
  let queued = true,
    valid = true,
    remote: EventMetadata | null = options.missing
      ? null
      : {
          ...metadata,
          ...(options.tombstone ? { status: "cancelled" } : {}),
          ...(options.wrongMarker ? { marker: randomUUID() } : {}),
          hasAttendees: !!options.guests,
        };
  let leaseId = randomUUID(),
    timeout = !!options.timeoutAfterCreate,
    savedCredential = "",
    dispatched = !!options.dispatched;
  const aad = "movx-calendar:v1:" + runId + ":" + profileId + ":refresh";
  const repository: ExportRepository = {
    async claim() {
      if (!queued) return null;
      queued = false;
      leaseId = randomUUID();
      return { kind: "claimed", id: randomUUID(), leaseId };
    },
    async command(_, action, input = {}) {
      calls.push(action);
      if (action === "finish") {
        outcomes.push(String(input.result));
        return { kind: valid ? "ok" : "stale" };
      }
      if (options.staleAt === action) valid = false;
      if (!valid) return { kind: "stale" };
      if (action === "prepare")
        return {
          kind: "prepared",
          profileId,
          runId,
          calendarId: calendar,
          eventId,
          marker,
          credential: seal("fixture-refresh", aad, config.keys),
          everDelivered: !!options.everDelivered,
          dispatched,
          desired: options.action ? { action: options.action } : terms,
        };
      if (action === "credential") savedCredential = String(input.credential);
      if (action === "dispatch") dispatched = true;
      return { kind: "ok" };
    },
  };
  const connection = {
    async refresh() {
      calls.push("refresh");
      if (options.revoked) throw new CalendarProviderError("authorization");
      return { accessToken: "fixture-access", refreshToken: undefined };
    },
    async calendar(
      _token: string,
      id: string,
      checkpoint: () => Promise<void>,
    ) {
      calls.push("calendar");
      await checkpoint();
      if (options.missingCalendar) throw new CalendarProviderError("missing");
      return id;
    },
  };
  const events = {
    async get() {
      calls.push("get");
      if (!remote) throw new CalendarEventError("missing");
      return remote;
    },
    async create(_token: string, _calendar: string, id: string) {
      calls.push("create:" + id);
      remote = metadata;
      if (options.staleAt === "provider-create") valid = false;
      if (timeout) {
        timeout = false;
        throw new CalendarEventError("transient");
      }
    },
    async update(_token: string, _calendar: string, id: string) {
      calls.push("update:" + id);
    },
    async remove(_token: string, _calendar: string, id: string) {
      calls.push("delete:" + id);
      remote = null;
    },
  };
  return {
    calls,
    outcomes,
    requeue() {
      queued = true;
      valid = true;
    },
    credential: () => savedCredential,
    run: () => dispatchCalendarExports(repository, config, connection, events),
    decrypt: () => unseal(savedCredential, aad, config.keys),
  };
}

test("Timeout after successful creation retries the same event and never allocates a second copy", async () => {
  const f = fixture({ missing: true, timeoutAfterCreate: true });
  assert.equal((await f.run()).failed, 1);
  assert.deepEqual(f.outcomes, ["transient"]);
  f.requeue();
  assert.equal((await f.run()).delivered, 1);
  assert.equal(f.calls.filter((x) => x.startsWith("create:")).length, 1);
  assert.deepEqual(
    f.calls.filter((x) => x.startsWith("update:")),
    ["update:" + eventId],
  );
  assert.equal(f.decrypt(), "fixture-refresh");
  assert.ok(!f.credential().includes("fixture-refresh"));
});

test("Missing-copy/calendar, revoked grant, uncertain cancellation and foreign/guest-bearing copies have distinct non-writing outcomes", async () => {
  for (const [options, expected] of [
    [{ missing: true, everDelivered: true }, "event-missing"],
    [{ tombstone: true, dispatched: true }, "event-missing"],
    [{ missing: true, missingCalendar: true }, "calendar-missing"],
    [{ revoked: true }, "authorization-required"],
    [{ missing: true, dispatched: true, action: "delete" }, "outcome-unknown"],
    [{ wrongMarker: true }, "ownership-conflict"],
    [{ guests: true }, "ownership-conflict"],
  ] as const) {
    const f = fixture(options);
    assert.equal((await f.run()).failed, 1);
    assert.deepEqual(f.outcomes, [expected]);
    assert.ok(!f.calls.some((x) => /^(create|update|delete):/.test(x)));
  }
});

test("Stale preparation/checkpoint prevents provider writes; stale completion cannot claim successful delivery", async () => {
  for (const staleAt of [
    "prepare",
    "checkpoint",
    "dispatch",
    "provider-create",
  ]) {
    const f = fixture({ missing: true, staleAt });
    const result = await f.run();
    assert.equal(result.stale, 1);
    assert.equal(result.delivered, 0);
    if (staleAt !== "provider-create")
      assert.ok(!f.calls.some((x) => /^(create|update|delete):/.test(x)));
  }
});

test("Completed history makes no Google request; an already absent known cancelled copy is safely reconciled", async () => {
  const retained = fixture({ action: "retain" });
  assert.equal((await retained.run()).retained, 1);
  assert.ok(!retained.calls.includes("refresh"));
  assert.ok(!retained.calls.includes("get"));
  const cancelled = fixture({
    action: "delete",
    missing: true,
    everDelivered: true,
    dispatched: true,
  });
  assert.equal((await cancelled.run()).delivered, 1);
  assert.deepEqual(cancelled.outcomes, ["deleted"]);
  assert.ok(!cancelled.calls.some((x) => /^(create|update|delete):/.test(x)));
  const tombstoned = fixture({
    action: "delete",
    tombstone: true,
    dispatched: true,
  });
  assert.equal((await tombstoned.run()).delivered, 1);
  assert.deepEqual(tombstoned.outcomes, ["deleted"]);
});
