import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseCalendarConfig } from "@/server/google-calendar/config";
import { seal, unseal } from "@/server/google-calendar/crypto";
import {
  CalendarProviderError,
  type GoogleCalendarProvider,
} from "@/server/google-calendar/provider";
import {
  calendarConnectionService,
  CalendarServiceError,
  type CalendarContext,
} from "@/server/google-calendar/service";
import {
  authorizationProof,
  readAuthorizationProof,
  type CalendarSyncIntent,
  type CalendarSyncOutcome,
} from "@/server/google-calendar/setup-intent";
import type { CalendarRecord } from "@/server/db/google-calendar/repository";

const config = parseCalendarConfig({
  MOVX_GOOGLE_CALENDAR_ENABLED: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  MOVX_GOOGLE_CALENDAR_CLIENT_ID: "fixture.apps.googleusercontent.com",
  MOVX_GOOGLE_CALENDAR_CLIENT_SECRET: "fixture-secret",
  MOVX_GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
})!;
function fixture(
  options: {
    available?: boolean;
    fail?: "permission" | "refresh" | "calendar";
    activation?: "unavailable" | "failure" | "unknown";
  } = {},
) {
  const owner: CalendarContext = {
    profileId: randomUUID(),
    runId: randomUUID(),
    subject: randomUUID(),
    sessionId: randomUUID(),
  };
  let current = { ...owner },
    browser: string | null = null,
    version = randomUUID(),
    enabled = false;
  let pending: Record<string, unknown> | null = null;
  let connection: CalendarRecord = {
    generation: randomUUID(),
    state: "disconnected",
    previous_state: "disconnected",
    google_sub: null,
    google_email: null,
    client_hash: null,
    credential_ciphertext: null,
    operation_id: null,
  };
  const calls: string[] = [],
    activations: CalendarSyncIntent[] = [];
  const aad = `movx-calendar:v1:${owner.runId}:${owner.profileId}:pkce`;
  const provider: GoogleCalendarProvider = {
    authorize(state, verifier) {
      assert.match(verifier, /^[\w-]{43}$/);
      calls.push("authorize");
      return `https://accounts.google.com/auth?state=${state}`;
    },
    async exchange(_, verifier) {
      assert.match(verifier, /^[\w-]{43}$/);
      calls.push("exchange");
      if (options.fail === "permission")
        throw new CalendarProviderError(
          "authorization",
          "calendar-permission-missing",
        );
      return { accessToken: "fixture-access", refreshToken: "fixture-refresh" };
    },
    async identity() {
      return { sub: "fixture-google", email: "fixture@example.test" };
    },
    async refresh() {
      calls.push("refresh");
      if (options.fail === "refresh")
        throw new CalendarProviderError("authorization");
      return { accessToken: "fixture-access", refreshToken: undefined };
    },
    async createCalendar() {
      calls.push("create");
      if (options.fail === "calendar")
        throw new CalendarProviderError("unavailable");
      return "fixture-calendar";
    },
    async calendar(_, id) {
      return id;
    },
    async deleteCalendar() {},
  };
  const bound = (ctx: CalendarContext) => {
    if (
      JSON.stringify(ctx) !== JSON.stringify(owner) ||
      JSON.stringify(current) !== JSON.stringify(owner)
    )
      throw new CalendarServiceError("forbidden");
  };
  const service = () =>
    calendarConnectionService({
      config,
      provider,
      async context() {
        return current;
      },
      cookie: {
        async read() {
          return browser;
        },
        async write(value) {
          browser = value;
        },
      },
      bookingSync: {
        async prepare(ctx, gen) {
          bound(ctx);
          calls.push("prepare");
          return options.available === false ||
            gen !== connection.generation ||
            connection.state !== "disconnected"
            ? null
            : version;
        },
        async enable(ctx, gen, intent): Promise<CalendarSyncOutcome> {
          bound(ctx);
          calls.push("enable");
          activations.push(intent);
          assert.equal(
            connection.state,
            "connected",
            "readiness commits before opt-in",
          );
          if (options.activation === "unavailable") return "unavailable";
          if (options.activation === "failure")
            throw Error("private transport failure");
          if (version !== intent.version || gen !== connection.generation)
            return "changed";
          enabled = true;
          version = randomUUID();
          if (options.activation === "unknown")
            throw Error("response lost after commit");
          return "enabled";
        },
      },
      async command(ctx, action, gen, input) {
        bound(ctx);
        calls.push(action);
        if (action === "begin") {
          const previous = connection.state;
          if (
            gen !== connection.generation ||
            (previous !== "disconnected" &&
              previous !== "connected" &&
              previous !== "reconnect-required" &&
              previous !== "recovery-required")
          )
            return { kind: "conflict" };
          connection = {
            ...connection,
            generation: randomUUID(),
            previous_state: previous,
            state: "connecting",
          };
          pending = { ...input };
          return { kind: "ok", record: connection };
        }
        if (action === "claim-callback") {
          if (
            !pending ||
            pending.stateHash !== input.stateHash ||
            pending.browserHash !== input.browserHash ||
            pending.sessionId !== input.sessionId
          )
            return { kind: "conflict" };
          const verifier = String(pending.verifier);
          pending = null;
          connection = {
            ...connection,
            operation_id: String(input.operationId),
          };
          return { kind: "ok", record: connection, verifier };
        }
        if (gen !== connection.generation) return { kind: "conflict" };
        if (action === "credentials")
          connection = {
            ...connection,
            google_sub: String(input.sub),
            google_email: String(input.email),
            client_hash: String(input.clientHash),
            credential_ciphertext: String(input.credential),
          };
        if (action === "bootstrap")
          return { kind: "ok", record: connection, mode: "create" };
        if (action === "finish")
          connection = {
            ...connection,
            state: input.state as CalendarRecord["state"],
            operation_id: null,
          };
        return { kind: "ok", record: connection };
      },
    });
  return {
    service,
    calls,
    activations,
    get connection() {
      return connection;
    },
    get enabled() {
      return enabled;
    },
    get version() {
      return version;
    },
    async start(sync = true) {
      const url = await service().start(connection.generation, sync);
      return {
        url,
        params: new URLSearchParams({
          state:
            new URL(url, "http://localhost:3100").searchParams.get("state") ??
            "",
          code: "fixture-code",
        }),
      };
    },
    expire() {
      pending = null;
    },
    changeBrowser() {
      browser = "x".repeat(43);
    },
    changeActor(field: keyof CalendarContext) {
      current = { ...current, [field]: randomUUID() };
    },
    pause() {
      enabled = false;
      version = randomUUID();
    },
    disconnect() {
      connection = {
        ...connection,
        generation: randomUUID(),
        state: "disconnected",
      };
      enabled = false;
    },
    rewriteProof(value: string) {
      assert.ok(pending);
      pending.verifier = seal(value, aad, config.keys);
    },
    proof() {
      assert.ok(pending);
      return unseal(String(pending.verifier), aad, config.keys);
    },
    // Simulate a concurrent operation after readiness but before activation.
    beforeEnable(work: () => void) {
      const original = provider.createCalendar;
      provider.createCalendar = async (token) => {
        const id = await original(token);
        work();
        return id;
      };
    },
  };
}

test("Combined setup survives a new request and enables once only after offline/calendar readiness", async () => {
  const f = fixture(),
    initial = f.version,
    { params } = await f.start();
  const proof = readAuthorizationProof(f.proof());
  assert.equal(proof.sync?.version, initial);
  assert.ok(proof.sync?.commandId);
  assert.equal(f.enabled, false);
  assert.match(
    await f.service().callback(params),
    /calendar=connected-sync-enabled$/,
  );
  assert.equal(f.enabled, true);
  assert.equal(f.connection.state, "connected");
  assert.equal(f.activations.length, 1);
  assert.ok(f.calls.indexOf("refresh") < f.calls.indexOf("finish"));
  assert.ok(f.calls.indexOf("finish") < f.calls.indexOf("enable"));
  assert.match(await f.service().callback(params), /calendar=unavailable$/);
  assert.equal(f.activations.length, 1);
});
test("Legacy connection and forged callback flags never imply sync consent", async () => {
  const f = fixture(),
    { params } = await f.start(false);
  assert.equal(readAuthorizationProof(f.proof()).sync, undefined);
  params.set("intent", "sync");
  params.set("syncBookings", "true");
  assert.match(await f.service().callback(params), /calendar=connected$/);
  assert.equal(f.enabled, false);
  assert.deepEqual(f.activations, []);
});
test("Unavailable export prevents combined authorization but permits connect-only fallback", async () => {
  const f = fixture({ available: false });
  assert.match((await f.start()).url, /calendar=sync-unavailable$/);
  assert.ok(!f.calls.includes("begin"));
  const { params } = await f.start(false);
  assert.match(await f.service().callback(params), /calendar=connected$/);
  assert.equal(f.enabled, false);
});
test("Denial and provider readiness failures never enable booking export", async () => {
  for (const fail of [
    undefined,
    "permission",
    "refresh",
    "calendar",
  ] as const) {
    const f = fixture({ fail }),
      { params } = await f.start();
    if (!fail) params.set("error", "access_denied");
    const result = await f.service().callback(params);
    assert.ok(!result.includes("connected-sync-enabled"));
    assert.equal(f.enabled, false);
    assert.deepEqual(f.activations, []);
  }
});
test("Expired, foreign, replayed or invalid browser/session/actor callbacks cannot apply setup intent", async () => {
  for (const change of [
    "expiry",
    "state",
    "browser",
    "sessionId",
    "profileId",
    "runId",
    "subject",
  ] as const) {
    const f = fixture(),
      { params } = await f.start();
    if (change === "expiry") f.expire();
    else if (change === "state") params.set("state", "x".repeat(43));
    else if (change === "browser") f.changeBrowser();
    else f.changeActor(change);
    assert.match(await f.service().callback(params), /calendar=unavailable$/);
    assert.equal(f.enabled, false);
    assert.deepEqual(f.activations, []);
    assert.ok(!f.calls.includes("exchange"));
  }
});
test("A later pause wins and a disconnected generation cannot be revived by setup", async () => {
  const paused = fixture(),
    p = await paused.start();
  paused.beforeEnable(() => paused.pause());
  assert.match(
    await paused.service().callback(p.params),
    /calendar=sync-settings-changed$/,
  );
  assert.equal(paused.enabled, false);
  const disconnected = fixture(),
    d = await disconnected.start();
  disconnected.beforeEnable(() => disconnected.disconnect());
  assert.match(
    await disconnected.service().callback(d.params),
    /calendar=unavailable$/,
  );
  assert.equal(disconnected.enabled, false);
  assert.equal(disconnected.connection.state, "disconnected");
  assert.deepEqual(disconnected.activations, []);
});
test("Ordinary reconnect preserves a paused preference and does not invent setup intent", async () => {
  const f = fixture(),
    first = await f.start();
  await f.service().callback(first.params);
  f.pause();
  const second = await f.start(false);
  assert.match(
    await f.service().callback(second.params),
    /calendar=connected$/,
  );
  assert.equal(f.enabled, false);
  assert.equal(f.activations.length, 1);
  assert.match((await f.start()).url, /calendar=sync-unavailable$/);
});
test("A failed or uncertain activation keeps readiness and gives read-back guidance without blind retry", async () => {
  for (const activation of ["unavailable", "failure", "unknown"] as const) {
    const f = fixture({ activation }),
      { params } = await f.start();
    assert.match(
      await f.service().callback(params),
      /calendar=sync-setup-incomplete$/,
    );
    assert.equal(f.connection.state, "connected");
    assert.equal(f.activations.length, 1);
    assert.equal(f.enabled, activation === "unknown");
    assert.equal(f.calls.filter((c) => c === "finish").length, 1);
    assert.ok(!f.calls.includes("delete"));
  }
});
test("Malformed encrypted setup proofs fail before exchanging Google codes", async () => {
  for (const value of [
    "{}",
    JSON.stringify({
      v: 2,
      verifier: "v".repeat(43),
      sync: { version: randomUUID(), commandId: randomUUID() },
      extra: true,
    }),
    JSON.stringify({
      v: 2,
      verifier: "v".repeat(43),
      sync: { version: "bad", commandId: randomUUID() },
    }),
  ]) {
    const f = fixture(),
      { params } = await f.start();
    f.rewriteProof(value);
    assert.match(await f.service().callback(params), /calendar=unavailable$/);
    assert.ok(!f.calls.includes("exchange"));
    assert.equal(f.enabled, false);
  }
  const intent = { version: randomUUID(), commandId: randomUUID() };
  assert.deepEqual(
    readAuthorizationProof(authorizationProof("v".repeat(43), intent)),
    { verifier: "v".repeat(43), sync: intent },
  );
  assert.deepEqual(readAuthorizationProof("legacy-verifier"), {
    verifier: "legacy-verifier",
  });
});
