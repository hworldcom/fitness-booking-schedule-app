import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCalendarConfig,
  CALENDAR_SCOPE,
} from "@/server/google-calendar/config";
import { challenge, seal, unseal } from "@/server/google-calendar/crypto";
import {
  googleCalendarProvider,
  CalendarProviderError,
  type GoogleCalendarProvider,
} from "@/server/google-calendar/provider";
import { calendarConnectionService } from "@/server/google-calendar/service";
import type { CalendarRecord } from "@/server/db/google-calendar/repository";

const env = {
  MOVX_GOOGLE_CALENDAR_ENABLED: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  MOVX_GOOGLE_CALENDAR_CLIENT_ID: "fixture.apps.googleusercontent.com",
  MOVX_GOOGLE_CALENDAR_CLIENT_SECRET: "fixture-client-secret",
  MOVX_GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 1).toString("base64"),
};
const config = parseCalendarConfig(env)!;
test("Calendar configuration fails closed and encryption binds owner/purpose while supporting rotation", () => {
  assert.equal(
    parseCalendarConfig({ ...env, MOVX_GOOGLE_CALENDAR_ENABLED: "false" }),
    null,
  );
  for (const patch of [
    { NEXT_PUBLIC_SITE_URL: "https://example.test/path" },
    { NEXT_PUBLIC_SITE_URL: "http://example.test" },
    { MOVX_GOOGLE_CALENDAR_TOKEN_KEY: "invalid" },
    { MOVX_GOOGLE_CALENDAR_CLIENT_SECRET: "" },
    { MOVX_GOOGLE_CALENDAR_CLIENT_ID: "evil.test" },
  ])
    assert.equal(parseCalendarConfig({ ...env, ...patch }), null);
  assert.equal(
    config.callbackUrl,
    "http://localhost:3100/auth/google-calendar/callback",
  );
  const ciphertext = seal(
    "fixture-refresh-token",
    "owner-a:refresh",
    config.keys,
  );
  assert.ok(!ciphertext.includes("fixture-refresh-token"));
  assert.equal(
    unseal(ciphertext, "owner-a:refresh", [
      Buffer.alloc(32, 2),
      ...config.keys,
    ]),
    "fixture-refresh-token",
  );
  assert.throws(
    () => unseal(ciphertext, "owner-b:refresh", config.keys),
    /unavailable/,
  );
  assert.throws(
    () => unseal(ciphertext, "owner-a:pkce", config.keys),
    /unavailable/,
  );
  assert.throws(
    () =>
      unseal(ciphertext.slice(0, -5) + "AAAAA", "owner-a:refresh", config.keys),
    /unavailable/,
  );
  assert.throws(
    () => unseal(ciphertext, "owner-a:refresh", [Buffer.alloc(32, 3)]),
    /unavailable/,
  );
});
test("Google protocol requests only app-created calendars and offline PKCE; proofs use POST bodies and private headers", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = googleCalendarProvider(config, async (url, init) => {
    calls.push({ url: String(url), init: init! });
    if (String(url).endsWith("/token"))
      return Response.json({
        access_token: "fixture-access",
        refresh_token: "fixture-refresh",
        token_type: "Bearer",
        scope: `openid email ${CALENDAR_SCOPE}`,
      });
    if (String(url).includes("userinfo"))
      return Response.json({
        sub: "google-1",
        email: "OWNER@example.test",
        email_verified: true,
      });
    if (String(url).includes("/events?"))
      return Response.json({ kind: "calendar#events" });
    return Response.json({ id: "fixture@group.calendar.google.com" });
  });
  const authorization = new URL(
    provider.authorize("fixture-state", "fixture-verifier"),
  );
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(
    authorization.searchParams.get("code_challenge"),
    challenge("fixture-verifier"),
  );
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorization.searchParams.get("access_type"), "offline");
  assert.equal(
    authorization.searchParams.get("scope"),
    `openid email ${CALENDAR_SCOPE}`,
  );
  assert.equal(authorization.searchParams.has("client_secret"), false);
  await provider.exchange("fixture-code", "fixture-verifier");
  await provider.refresh("fixture-refresh");
  assert.deepEqual(await provider.identity("fixture-access"), {
    sub: "google-1",
    email: "owner@example.test",
  });
  const id = await provider.createCalendar("fixture-access");
  await provider.calendar("fixture-access", id, async () => {});
  for (const c of calls) {
    assert.equal(c.init.cache, "no-store");
    assert.equal(c.init.redirect, "error");
    assert.ok(
      !/fixture-access|fixture-refresh|fixture-code|fixture-client-secret/.test(
        c.url,
      ),
    );
  }
  assert.equal(
    new URLSearchParams(calls[0].init.body as URLSearchParams).get(
      "code_verifier",
    ),
    "fixture-verifier",
  );
  assert.deepEqual(JSON.parse(calls[3].init.body as string), {
    summary: "MovX",
    timeZone: "Europe/Berlin",
  });
});
test("Google malformed/missing scopes, unverified identity and provider failures yield redacted typed errors", async () => {
  for (const payload of [
    { access_token: "a", token_type: "Bearer", scope: "openid email" },
    { access_token: "a", token_type: "Bearer" },
    {
      access_token: "a",
      token_type: "Bearer",
      scope: CALENDAR_SCOPE,
      refresh_token: "",
    },
  ]) {
    const p = googleCalendarProvider(config, async () =>
      Response.json(payload),
    );
    await assert.rejects(
      p.exchange("fixture-private-proof", "v"),
      (e) => e instanceof CalendarProviderError && e.kind === "authorization",
    );
  }
  const unverified = googleCalendarProvider(config, async () =>
    Response.json({
      sub: "google-1",
      email: "a@example.test",
      email_verified: false,
    }),
  );
  await assert.rejects(
    unverified.identity("fixture-access"),
    CalendarProviderError,
  );
  for (const [status, kind] of [
    [401, "authorization"],
    [403, "authorization"],
    [404, "missing"],
    [429, "unavailable"],
    [503, "unavailable"],
  ] as const) {
    const p = googleCalendarProvider(
      config,
      async () => new Response("fixture-private-provider-body", { status }),
    );
    await assert.rejects(
      p.calendar("a", "fixture-calendar", async () => {}),
      (e) =>
        e instanceof CalendarProviderError &&
        e.kind === kind &&
        !e.message.includes("fixture-private"),
    );
  }
});

const ctx = {
  profileId: "11111111-1111-4111-8111-111111111111",
  runId: "22222222-2222-4222-8222-222222222222",
  subject: "33333333-3333-4333-8333-333333333333",
  sessionId: "44444444-4444-4444-8444-444444444444",
};
const record: CalendarRecord = {
  generation: "55555555-5555-4555-8555-555555555555",
  state: "connecting",
  previous_state: "disconnected",
  google_sub: null,
  google_email: null,
  client_hash: null,
  credential_ciphertext: null,
  operation_id: "66666666-6666-4666-8666-666666666666",
};
function fixture(
  options: {
    old?: Partial<CalendarRecord>;
    sub?: string;
    missingRefresh?: boolean;
    uncertain?: boolean;
    createFails?: boolean;
  } = {},
) {
  let c = { ...record, ...options.old };
  const commands: { action: string; input: Record<string, unknown> }[] = [],
    http: string[] = [];
  const provider: GoogleCalendarProvider = {
    authorize: () => "https://accounts.google.com/o/oauth2/v2/auth",
    exchange: async () => {
      http.push("exchange");
      return {
        accessToken: "fixture-access",
        refreshToken: options.missingRefresh ? undefined : "fixture-refresh",
      };
    },
    identity: async () => {
      http.push("identity");
      return { sub: options.sub ?? "google-1", email: "owner@example.test" };
    },
    refresh: async () => {
      http.push("refresh");
      return { accessToken: "refreshed-access", refreshToken: undefined };
    },
    createCalendar: async () => {
      http.push("create");
      if (options.createFails) throw new CalendarProviderError("unavailable");
      return "fixture-calendar";
    },
    calendar: async (_, id) => {
      http.push("verify");
      return id;
    },
  };
  const aad = `movx-calendar:v1:${ctx.runId}:${ctx.profileId}:pkce`;
  const service = calendarConnectionService({
    config,
    provider,
    context: async () => ctx,
    cookie: { read: async () => "b".repeat(43), write: async () => {} },
    command: async (_, action, _gen, input) => {
      commands.push({ action, input });
      if (action === "claim-callback")
        return {
          kind: "ok",
          record: c,
          verifier: seal("fixture-verifier", aad, config.keys),
        };
      if (action === "credentials")
        c = {
          ...c,
          google_sub: input.sub as string,
          client_hash: input.clientHash as string,
          credential_ciphertext: input.credential as string,
        };
      if (action === "bootstrap")
        return options.uncertain
          ? { kind: "recovery-required" }
          : { kind: "ok", mode: "create" };
      return { kind: "ok", record: c };
    },
  });
  return { service, commands, http };
}
const params = () =>
  new URLSearchParams({ state: "s".repeat(43), code: "fixture-code" });
test("Connection callback proves refresh, stores encrypted credentials and creates only the app calendar", async () => {
  const f = fixture();
  assert.match(await f.service.callback(params()), /calendar=connected$/);
  assert.deepEqual(f.http, ["exchange", "identity", "refresh", "create"]);
  assert.deepEqual(
    f.commands.map((c) => c.action),
    [
      "claim-callback",
      "heartbeat",
      "credentials",
      "bootstrap",
      "record-calendar",
      "finish",
    ],
  );
  const credential = f.commands.find((c) => c.action === "credentials")!.input
    .credential as string;
  assert.ok(!credential.includes("fixture-refresh"));
});
test("Deny/account mismatch/missing offline credentials preserve identity without creating calendars", async () => {
  const denied = fixture();
  const p = params();
  p.set("error", "access_denied");
  assert.match(await denied.service.callback(p), /calendar=denied$/);
  assert.equal(denied.http.length, 0);
  const mismatch = fixture({
    old: { previous_state: "connected", google_sub: "original-google" },
    sub: "other-google",
  });
  assert.match(
    await mismatch.service.callback(params()),
    /calendar=account-mismatch$/,
  );
  assert.ok(!mismatch.http.includes("create"));
  assert.ok(!mismatch.commands.some((c) => c.action === "credentials"));
  const missing = fixture({ missingRefresh: true });
  assert.match(
    await missing.service.callback(params()),
    /calendar=unavailable$/,
  );
  assert.ok(!missing.http.includes("create"));
});
test("Uncertain calendar bootstrap never automatically repeats creation and failed creation enters recovery", async () => {
  const uncertain = fixture({ uncertain: true });
  assert.match(
    await uncertain.service.callback(params()),
    /calendar=recovery-required$/,
  );
  assert.ok(!uncertain.http.includes("create"));
  const failed = fixture({ createFails: true });
  assert.match(
    await failed.service.callback(params()),
    /calendar=recovery-required$/,
  );
  assert.equal(failed.http.filter((x) => x === "create").length, 1);
});
test("An omitted refresh token preserves a valid same-account stored token; callback replay/context rejection makes no provider call", async () => {
  const credential = seal(
    "old-fixture-refresh",
    `movx-calendar:v1:${ctx.runId}:${ctx.profileId}:refresh`,
    config.keys,
  );
  const f = fixture({
    missingRefresh: true,
    old: {
      google_sub: "google-1",
      client_hash: config.clientHash,
      credential_ciphertext: credential,
      previous_state: "connected",
    },
  });
  assert.match(await f.service.callback(params()), /calendar=connected$/);
  let calls = 0;
  const noClaim = calendarConnectionService({
    config,
    provider: googleCalendarProvider(config, async () => {
      calls++;
      throw Error();
    }),
    context: async () => ctx,
    cookie: { read: async () => "b".repeat(43), write: async () => {} },
    command: async () => ({ kind: "conflict" }),
  });
  assert.match(await noClaim.callback(params()), /calendar=unavailable$/);
  assert.equal(calls, 0);
});

test("A disconnect/session fence after metadata prevents a subsequent Google collection request", async () => {
  let requests = 0;
  const provider = googleCalendarProvider(config, async () => {
    requests++;
    return Response.json({ id: "fixture-calendar" });
  });
  await assert.rejects(
    provider.calendar("fixture-access", "fixture-calendar", async () => {
      throw Error("Operation no longer authorized");
    }),
    /no longer authorized/,
  );
  assert.equal(
    requests,
    1,
    "no second Google request after the operation is invalidated",
  );
});
