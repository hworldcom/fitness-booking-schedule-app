import assert from "node:assert/strict";
import test from "node:test";
import { parseSupabasePublicConfig } from "@/auth/config";
import {
  createGoogleAuthentication,
  GOOGLE_FLOW_COOKIE,
  googleProviderAvailable,
} from "@/server/auth/google";
import type { serverAuthClient } from "@/server/auth/client";
import type { VerifiedAuthContext } from "@/server/auth/session";
import { POST } from "@/app/auth/google/start/route";

const config = parseSupabasePublicConfig(
  "https://auth.movx.test",
  "public-fixture-key",
  "https://uat.movx.test",
)!;
const subject = "90000000-0000-4000-8000-000000000001";
const sessionId = "90000000-0000-4000-8000-000000000002";
const oldSessionId = "90000000-0000-4000-8000-000000000003";
const id = "a".repeat(64),
  code = "b".repeat(32);
const signedOut: VerifiedAuthContext = {
  session: { status: "signed-out" },
  authSessionId: null,
  emailOtpAuthenticatedAt: null,
};
const signedIn: VerifiedAuthContext = {
  session: {
    status: "signed-in",
    subject,
    email: "athlete@example.test",
    expiresAt: 2_000_000_000,
  },
  authSessionId: sessionId,
  emailOtpAuthenticatedAt: null,
};

function fixture() {
  const jar = new Map<string, string>(),
    calls: string[] = [];
  const state = {
    now: 1_800_000_000_000,
    previous: signedOut,
    current: signedIn,
    purpose: "ordinary" as "ordinary" | "recovery",
    available: true,
    exchangeError: false,
    grant: true,
    googleIdentity: true,
    redirectType: null as string | null,
    badAuthorize: false,
    flowId: id,
    destination: "/messages",
  };
  const store = {
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      assert.equal(options.httpOnly, true);
      assert.equal(options.sameSite, "lax");
      assert.equal(options.secure, true);
      assert.equal(options.maxAge, 600);
      jar.set(name, value);
    },
    delete: (name: string) => jar.delete(name),
  };
  const client = {
    auth: {
      signInWithOAuth: async (input: {
        provider: string;
        options: {
          redirectTo: string;
          scopes: string;
          queryParams: Record<string, string>;
          skipBrowserRedirect: boolean;
        };
      }) => {
        calls.push("start");
        assert.equal(input.provider, "google");
        assert.equal(input.options.scopes, "openid email profile");
        assert.equal(input.options.skipBrowserRedirect, true);
        assert.deepEqual(input.options.queryParams, {
          prompt: "select_account",
        });
        const url = new URL("/auth/v1/authorize", config.url);
        url.search = new URLSearchParams({
          provider: "google",
          redirect_to: input.options.redirectTo,
          code_challenge: "x".repeat(43),
          code_challenge_method: "s256",
        }).toString();
        return {
          data: {
            url: state.badAuthorize ? "https://outside.test" : url.toString(),
          },
          error: null,
        };
      },
      exchangeCodeForSession: async (value: string) => {
        calls.push("exchange");
        assert.equal(value, code);
        return {
          error: state.exchangeError
            ? { message: "secret upstream failure" }
            : null,
          data: {
            user: {
              id: subject,
              identities: state.googleIdentity
                ? [{ provider: "google" }]
                : [{ provider: "email" }],
              user_metadata: {
                role: "coach",
                full_name: "Do not copy",
                avatar_url: "https://outside.test",
              },
            },
            redirectType: state.redirectType,
          },
        };
      },
      signOut: async () => {
        calls.push("sign-out");
        return { error: null };
      },
    },
  } as unknown as NonNullable<Awaited<ReturnType<typeof serverAuthClient>>>;
  const auth = createGoogleAuthentication({
    config: () => config,
    available: async () => state.available,
    now: () => state.now,
    random: () => state.flowId,
    store: async () =>
      store as unknown as Awaited<
        ReturnType<typeof import("next/headers").cookies>
      >,
    client: async () => client,
    verified: async (provided) => (provided ? state.current : state.previous),
    purpose: async () => state.purpose,
    grant: async (value, session, purpose, continuation) => {
      calls.push("grant");
      assert.equal(value, subject);
      assert.equal(session, sessionId);
      assert.equal(purpose, "ordinary");
      assert.equal(continuation?.returnTo, "/messages");
      return state.grant;
    },
    revoke: async (value, session) => {
      calls.push("revoke-previous");
      assert.equal(value, subject);
      assert.equal(session, oldSessionId);
    },
    destination: async (continuation) => {
      calls.push("destination");
      assert.equal(continuation.returnTo, "/messages");
      return state.destination;
    },
  });
  const start = (returnTo = "/messages") =>
    auth.start({ action: "start-google", returnTo, intent: "coach" });
  const callback = (extra = "") =>
    auth.callback(new URLSearchParams(`flow=${id}&code=${code}${extra}`));
  return { auth, jar, calls, state, start, callback };
}

test("Google availability requires explicit activation and a successful managed settings response", async () => {
  let calls = 0;
  const transport: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.redirect, "error");
    return Response.json({ external: { google: true } });
  };
  assert.equal(await googleProviderAvailable(config, false, transport), false);
  assert.equal(await googleProviderAvailable(null, true, transport), false);
  assert.equal(calls, 0);
  assert.equal(await googleProviderAvailable(config, true, transport), true);
  for (const value of [
    {},
    { external: { google: false } },
    { external: { google: "true" } },
    null,
  ])
    assert.equal(
      await googleProviderAvailable(config, true, async () =>
        Response.json(value),
      ),
      false,
    );
  assert.equal(
    await googleProviderAvailable(config, true, async () => {
      throw new Error("private network detail");
    }),
    false,
  );
  assert.equal(
    await googleProviderAvailable(config, true, async () =>
      Response.json({ external: { google: true } }, { status: 503 }),
    ),
    false,
  );
});

test("SDK start uses minimal Google scopes and grants no application authority before proof", async () => {
  const f = fixture(),
    location = new URL(await f.start());
  assert.equal(location.origin, config.url);
  assert.equal(location.searchParams.get("provider"), "google");
  assert.deepEqual(f.calls, ["start"]);
  assert.ok(f.jar.has(GOOGLE_FLOW_COOKIE));
  assert.equal(await f.callback(), "/messages");
  assert.deepEqual(f.calls, ["start", "exchange", "grant", "destination"]);
  assert.equal(f.jar.has(GOOGLE_FLOW_COOKIE), false);
  assert.match(await f.callback(), /notice=google-failed$/);
  assert.equal(f.calls.filter((c) => c === "exchange").length, 1);
});

test("callback checks browser binding and age before exchanging or disturbing another flow", async () => {
  for (const params of [
    new URLSearchParams(),
    new URLSearchParams(`flow=wrong&code=${code}`),
    new URLSearchParams(`flow=${id}&flow=${id}&code=${code}`),
  ]) {
    const f = fixture();
    await f.start();
    assert.match(await f.auth.callback(params), /notice=google-failed$/);
    assert.deepEqual(f.calls, ["start"]);
    assert.ok(f.jar.has(GOOGLE_FLOW_COOKIE));
  }
  for (const delta of [600_001, -1]) {
    const f = fixture();
    await f.start();
    f.state.now += delta;
    assert.match(await f.callback(), /notice=google-failed$/);
    assert.deepEqual(f.calls, ["start"]);
  }
});

test("a newer start supersedes the old flow without letting an old callback consume its verifier", async () => {
  const f = fixture();
  await f.start();
  f.state.flowId = "c".repeat(64);
  await f.start();
  f.jar.set("sb-fixture-auth-token-google-code-verifier", "new-verifier");
  f.jar.set("sb-fixture-auth-token-code-verifier", "email-verifier");
  assert.match(await f.callback(), /notice=google-failed$/);
  assert.ok(f.jar.has(GOOGLE_FLOW_COOKIE));
  assert.equal(f.calls.includes("exchange"), false);
  assert.equal(
    await f.auth.callback(new URLSearchParams({ flow: f.state.flowId, code })),
    "/messages",
  );
  assert.equal(f.jar.has("sb-fixture-auth-token-google-code-verifier"), false);
  assert.equal(
    f.jar.get("sb-fixture-auth-token-code-verifier"),
    "email-verifier",
  );
});

test("a failed new grant preserves the previous browser grant and cannot reuse its session as new proof", async () => {
  for (const sameSession of [false, true]) {
    const f = fixture();
    f.state.previous = { ...signedIn, authSessionId: oldSessionId };
    await f.start();
    if (sameSession) f.state.current = f.state.previous;
    else f.state.grant = false;
    assert.match(await f.callback(), /notice=google-failed$/);
    assert.equal(f.calls.includes("revoke-previous"), false);
    assert.equal(f.calls.includes("destination"), false);
    assert.ok(f.calls.includes("sign-out"));
  }
});

test("cancellation, duplicate/missing code and provider errors expose bounded retry notices only", async () => {
  for (const query of [
    `flow=${id}&error=access_denied&error_description=PRIVATE`,
    `flow=${id}`,
    `flow=${id}&code=${code}&code=${code}`,
    `flow=${id}&code=bad`,
    `flow=${id}&error=PRIVATE`,
  ]) {
    const f = fixture();
    await f.start();
    const location = await f.auth.callback(new URLSearchParams(query));
    assert.match(location, /notice=google-(cancelled|failed)$/);
    assert.doesNotMatch(location, /PRIVATE|code=|error_description/);
    assert.deepEqual(f.calls, ["start"]);
    assert.equal(f.jar.size, 0);
  }
});

test("recovery, changed browser sessions and unavailable configuration cannot be upgraded by Google", async () => {
  const blocked = fixture();
  blocked.state.previous = signedIn;
  blocked.state.purpose = "recovery";
  assert.equal(await blocked.start(), "/reset-password");
  assert.deepEqual(blocked.calls, []);
  for (const scenario of ["recovery", "changed", "unavailable"] as const) {
    const f = fixture();
    await f.start();
    if (scenario !== "unavailable") f.state.previous = signedIn;
    if (scenario === "recovery") f.state.purpose = "recovery";
    if (scenario === "unavailable") f.state.available = false;
    assert.match(
      await f.callback(),
      scenario === "recovery"
        ? /^\/reset-password$/
        : /notice=google-(failed|unavailable)$/,
    );
    assert.deepEqual(f.calls, ["start"]);
  }
  const f = fixture();
  f.state.available = false;
  assert.match(await f.start(), /notice=google-unavailable$/);
  assert.deepEqual(f.calls, []);
});

test("failed exchange or unverified/mismatched/non-Google/recovery proof never grants authority", async () => {
  for (const scenario of [
    "exchange",
    "unverified",
    "subject",
    "email-only",
    "recovery",
    "grant",
  ] as const) {
    const f = fixture();
    await f.start();
    if (scenario === "exchange") f.state.exchangeError = true;
    if (scenario === "unverified")
      f.state.current = { ...signedOut, session: { status: "unavailable" } };
    if (scenario === "subject")
      f.state.current = {
        ...signedIn,
        session: {
          ...(signedIn.session as Extract<
            VerifiedAuthContext["session"],
            { status: "signed-in" }
          >),
          subject: "other-subject",
        },
      };
    if (scenario === "email-only") f.state.googleIdentity = false;
    if (scenario === "recovery") f.state.redirectType = "recovery";
    if (scenario === "grant") f.state.grant = false;
    assert.match(await f.callback(), /notice=google-failed$/);
    assert.equal(f.calls.includes("destination"), false);
    assert.equal(f.calls.includes("grant"), scenario === "grant");
    assert.equal(f.calls.includes("sign-out"), scenario !== "exchange");
  }
});

test("returning identity retires only its previous browser grant after new proof; names and roles are not copied", async () => {
  const f = fixture();
  f.state.previous = { ...signedIn, authSessionId: oldSessionId };
  await f.start();
  assert.equal(await f.callback(), "/messages");
  assert.deepEqual(f.calls, [
    "start",
    "exchange",
    "grant",
    "revoke-previous",
    "destination",
  ]);
});

test("unsafe returns and unexpected provider redirect origins cannot escape the Auth adapter", async () => {
  const f = fixture();
  await f.start("//outside.test");
  const cookie = JSON.parse(
    Buffer.from(f.jar.get(GOOGLE_FLOW_COOKIE)!, "base64url").toString(),
  );
  assert.equal(cookie.returnTo, "/");
  const broken = fixture();
  broken.state.badAuthorize = true;
  assert.match(await broken.start(), /notice=google-unavailable$/);
  assert.equal(broken.jar.size, 0);
});

test("navigation POST rejects CSRF, extra authority, duplicate fields and oversized input before Auth", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = config.url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = config.publishableKey;
  process.env.NEXT_PUBLIC_SITE_URL = config.siteUrl;
  for (const fetchSite of [undefined, "cross-site", "same-site", "none"]) {
    const response = await POST(
      new Request(`${config.siteUrl}/auth/google/start`, {
        method: "POST",
        headers: {
          origin: "null",
          "content-type": "application/x-www-form-urlencoded",
          ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}),
        },
        body: "",
      }),
    );
    assert.equal(response.status, 403);
  }
  const foreign = await POST(
    new Request(`${config.siteUrl}/auth/google/start`, {
      method: "POST",
      headers: {
        origin: "https://outside.test",
        "sec-fetch-site": "same-origin",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    }),
  );
  assert.equal(foreign.status, 403);
  for (const origin of ["null", config.siteUrl]) {
    const response = await POST(
      new Request(`${config.siteUrl}/auth/google/start`, {
        method: "POST",
        headers: {
          origin,
          "sec-fetch-site": "same-origin",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "subject=forged",
      }),
    );
    assert.equal(response.status, 400);
  }
  for (const [origin, contentType, body, status] of [
    ["https://outside.test", "application/x-www-form-urlencoded", "", 403],
    [config.siteUrl, "application/json", "{}", 400],
    [
      config.siteUrl,
      "application/x-www-form-urlencoded",
      "provider=apple",
      400,
    ],
    [
      config.siteUrl,
      "application/x-www-form-urlencoded",
      "subject=forged",
      400,
    ],
    [
      config.siteUrl,
      "application/x-www-form-urlencoded",
      "returnTo=/&returnTo=/messages",
      400,
    ],
    [config.siteUrl, "application/x-www-form-urlencoded", "intent=admin", 400],
    [
      config.siteUrl,
      "application/x-www-form-urlencoded",
      "x".repeat(8193),
      400,
    ],
  ] as const) {
    const response = await POST(
      new Request(`${config.siteUrl}/auth/google/start`, {
        method: "POST",
        headers: { origin, "content-type": contentType },
        body,
      }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});
