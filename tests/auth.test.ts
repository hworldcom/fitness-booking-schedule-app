import assert from "node:assert/strict";
import test from "node:test";
import {
  isCanonicalSignInLocation,
  parseSupabasePublicConfig,
} from "../src/auth/config";
import { isAuthSessionSnapshot } from "../src/auth/contracts";
import {
  authServiceTransportErrorMessage,
  authServiceUnavailableCopy,
  createAuthServiceFetch,
  isLocalAuthServiceUrl,
} from "../src/auth/service-availability";
import {
  emailOtpErrorMessage,
  normalizeEmail,
  normalizeEmailOtp,
} from "../src/auth/email-otp";
import {
  EMAIL_REAUTHENTICATION_WINDOW_SECONDS,
  isRecentEmailOtpAuthentication,
  latestEmailOtpAuthenticationAt,
} from "../src/auth/reauthentication";

test("public Auth config requires a secure site or literal localhost", () => {
  const local = parseSupabasePublicConfig(
    "http://127.0.0.1:55321/",
    "public-key",
    "http://localhost:3100",
  );
  assert.deepEqual(local, {
    url: "http://127.0.0.1:55321",
    publishableKey: "public-key",
    siteUrl: "http://localhost:3100",
    signInUrl: "http://localhost:3100/sign-in",
  });
  assert.equal(
    parseSupabasePublicConfig(
      "http://127.0.0.1:55321",
      "public-key",
      "http://127.0.0.1:3100",
    ),
    null,
  );
  assert.equal(
    parseSupabasePublicConfig(
      "https://example.supabase.co",
      "public-key",
      "https://club.example/sign-in",
    ),
    null,
  );
  assert.equal(
    parseSupabasePublicConfig(undefined, undefined, undefined),
    null,
  );
});

test("email and one-time-code inputs normalize to bounded values", () => {
  assert.equal(normalizeEmail(" Anna@Example.COM "), "anna@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(`${"a".repeat(250)}@example.com`), null);
  assert.equal(normalizeEmailOtp(" 123 456 "), "123456");
  assert.equal(normalizeEmailOtp("12345"), null);
  assert.equal(normalizeEmailOtp("12345a"), null);
});

test("verified session responses require a bounded email identity", () => {
  const session = {
    status: "signed-in",
    subject: "93000000-0000-4000-8000-000000000001",
    email: "anna@example.com",
    expiresAt: 1_800_000_000,
  };
  assert.equal(isAuthSessionSnapshot(session), true);
  assert.equal(isAuthSessionSnapshot({ ...session, email: "invalid" }), false);
  assert.equal(
    isAuthSessionSnapshot({
      status: "signed-in",
      subject: session.subject,
      walletAddress: "7YWHMfk9JZe1LM1W7mFDJH8QvJ75zEQY4zBbDx8kPn9M",
      expiresAt: session.expiresAt,
    }),
    false,
  );
});

test("OTP failures use bounded copy without echoing provider details", () => {
  assert.match(
    emailOtpErrorMessage(
      {
        status: 0,
        message:
          'Local Supabase Auth could not be reached. Run "npm run auth:start", then retry.',
      },
      "request",
    ),
    /local supabase auth is unreachable.*npm run auth:start/i,
  );
  assert.match(
    emailOtpErrorMessage({ status: 429, message: "raw body" }, "request"),
    /too many/i,
  );
  assert.match(
    emailOtpErrorMessage(
      { status: 400, message: "User account does not exist" },
      "request",
    ),
    /couldn’t send/i,
  );
  assert.match(
    emailOtpErrorMessage(
      { status: 403, message: "token for secret@example.com expired" },
      "verify",
    ),
    /invalid or expired/i,
  );
  assert.equal(
    emailOtpErrorMessage(
      { status: 400, message: "User account does not exist" },
      "request",
    ).includes("does not exist"),
    false,
  );
});

test("Auth service diagnostics distinguish local and hosted endpoints", () => {
  assert.equal(isLocalAuthServiceUrl("http://localhost:55321"), true);
  assert.equal(isLocalAuthServiceUrl("http://127.0.0.1:55321"), true);
  assert.equal(isLocalAuthServiceUrl("http://127.42.0.8:55321"), true);
  assert.equal(isLocalAuthServiceUrl("http://[::1]:55321"), true);
  assert.equal(isLocalAuthServiceUrl("https://project.supabase.co"), false);

  const localCopy = authServiceUnavailableCopy("http://127.0.0.1:55321");
  assert.match(localCopy.title, /local supabase auth is unreachable/i);
  assert.equal(localCopy.recoveryCommand, "npm run auth:start");
  assert.match(localCopy.detail, /127\.0\.0\.1:55321/);

  const hostedUrl = "https://private-project.supabase.co";
  const hostedCopy = authServiceUnavailableCopy(hostedUrl);
  assert.equal(hostedCopy.recoveryCommand, null);
  assert.doesNotMatch(hostedCopy.detail, /private-project|supabase\.co/i);
  assert.doesNotMatch(
    authServiceTransportErrorMessage(hostedUrl),
    /private-project|supabase\.co/i,
  );
});

test("Auth fetch wraps transport failures with actionable bounded context", async () => {
  const successfulResponse = new Response(null, { status: 204 });
  const successfulFetch = createAuthServiceFetch(
    "http://127.0.0.1:55321",
    (() => Promise.resolve(successfulResponse)) as typeof fetch,
  );
  assert.equal(
    await successfulFetch("http://127.0.0.1:55321/auth/v1/health"),
    successfulResponse,
  );

  const failingFetch = (() =>
    Promise.reject(
      new TypeError("secret low-level network detail"),
    )) as typeof fetch;
  const localFetch = createAuthServiceFetch(
    "http://127.0.0.1:55321",
    failingFetch,
  );
  const hostedFetch = createAuthServiceFetch(
    "https://private-project.supabase.co",
    failingFetch,
  );

  await assert.rejects(
    localFetch("http://127.0.0.1:55321/auth/v1/user"),
    (error: Error) => {
      assert.match(error.message, /npm run auth:start/);
      assert.doesNotMatch(error.message, /secret low-level/);
      return true;
    },
  );
  await assert.rejects(
    hostedFetch("https://private-project.supabase.co/auth/v1/user"),
    (error: Error) => {
      assert.match(error.message, /configured supabase auth service/i);
      assert.doesNotMatch(error.message, /private-project|secret low-level/i);
      return true;
    },
  );

  const aborted = new DOMException("The operation was aborted", "AbortError");
  const abortedFetch = createAuthServiceFetch("http://127.0.0.1:55321", (() =>
    Promise.reject(aborted)) as typeof fetch);
  await assert.rejects(
    abortedFetch("http://127.0.0.1:55321/auth/v1/user"),
    (error) => error === aborted,
  );
});

test("canonical sign-in checking permits return queries on the exact route", () => {
  const config = parseSupabasePublicConfig(
    "http://127.0.0.1:55321",
    "public-key",
    "http://localhost:3100",
  );
  assert.ok(config);
  assert.equal(
    isCanonicalSignInLocation(config, {
      origin: "http://localhost:3100",
      pathname: "/sign-in",
      search: "?returnTo=/profile",
      hash: "",
    }),
    true,
  );
  assert.equal(
    isCanonicalSignInLocation(config, {
      origin: "https://example.com",
      pathname: "/sign-in",
      search: "?returnTo=/profile",
      hash: "",
    }),
    false,
  );
});

test("wallet security changes require a recent detailed email OTP claim", () => {
  const now = 2_000_000_000;
  assert.equal(
    latestEmailOtpAuthenticationAt([
      { method: "password", timestamp: now },
      { method: "otp", timestamp: now - 30 },
      { method: "otp", timestamp: now - 10 },
    ]),
    now - 10,
  );
  assert.equal(latestEmailOtpAuthenticationAt(["otp"]), null);
  assert.equal(
    latestEmailOtpAuthenticationAt([{ method: "otp", timestamp: "recent" }]),
    null,
  );
  assert.equal(isRecentEmailOtpAuthentication(now - 1, now), true);
  assert.equal(
    isRecentEmailOtpAuthentication(
      now - EMAIL_REAUTHENTICATION_WINDOW_SECONDS,
      now,
    ),
    true,
  );
  assert.equal(
    isRecentEmailOtpAuthentication(
      now - EMAIL_REAUTHENTICATION_WINDOW_SECONDS - 1,
      now,
    ),
    false,
  );
  assert.equal(isRecentEmailOtpAuthentication(now + 31, now), false);
  assert.equal(isRecentEmailOtpAuthentication(null, now), false);
});
