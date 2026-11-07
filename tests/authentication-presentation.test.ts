import assert from "node:assert/strict";
import test from "node:test";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import {
  SignInScreen,
  type AuthenticationStage,
} from "@/features/auth/sign-in";

function screen(
  stage: AuthenticationStage,
  session: AuthSessionSnapshot = { status: "signed-out" },
  returnTo = "/",
  emailPurpose: "confirmation" | "recovery" = "confirmation",
  googleNotice?: "google-cancelled" | "google-failed" | "google-unavailable",
) {
  return renderToStaticMarkup(
    jsx(AuthSessionProvider, {
      initialSession: session,
      children: jsx(ActorProvider, {
        initialActor: { status: "signed-out" },
        children: jsx(SignInScreen, {
          stage,
          returnTo,
          intent: "coach",
          emailPurpose,
          googleNotice,
        }),
      }),
    }),
  );
}

test("entry forms retain password-manager semantics and cannot submit before hydration", () => {
  for (const stage of ["sign-in", "register"] as const) {
    const html = screen(stage);
    assert.match(html, /<fieldset disabled=""/);
    assert.match(html, /<input[^>]*autoComplete="email"[^>]*name="email"/);
    assert.match(html, /autoCapitalize="none" spellCheck="false"/);
    assert.match(
      html,
      new RegExp(
        `<input[^>]*type="password"[^>]*autoComplete="${stage === "sign-in" ? "current-password" : "new-password"}"[^>]*name="password"`,
      ),
    );
    assert.match(html, /aria-label="Show password" aria-pressed="false"/);
    assert.match(html, /disabled="" aria-describedby="google-unavailable"/);
    assert.match(html, /Google sign-in is currently unavailable/);
    assert.doesNotMatch(html, /Apple|email code|Six-digit code/);
    assert.match(html, /href="\/explore"/);
  }
});

test("Google notices offer bounded retry without removing password recovery or registration", () => {
  for (const notice of [
    "google-cancelled",
    "google-failed",
    "google-unavailable",
  ] as const) {
    const html = screen(
      "sign-in",
      { status: "signed-out" },
      "/messages",
      "confirmation",
      notice,
    );
    assert.match(html, /role="status"/);
    assert.match(html, /Google sign-in/);
    assert.match(html, /use email|Use email/);
    assert.match(html, /href="\/forgot-password\?returnTo=%2F/);
    assert.match(html, /href="\/register\?returnTo=%2F/);
    assert.doesNotMatch(html, /token_hash|access_token|error_description/);
  }
});

test("email request alternatives keep invitation continuation without claiming delivery or account existence", (t) => {
  const config = {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-presentation-fixture",
  };
  const previous = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const purpose of ["confirmation", "recovery"] as const) {
    const html = screen(
      "check-email",
      { status: "signed-out" },
      "/invitations",
      purpose,
    );
    assert.match(html, /If this address is eligible/);
    assert.match(html, /If an email arrives/);
    assert.doesNotMatch(html, /on its way|email (?:was|has been) sent/);
    for (const path of ["sign-in", "forgot-password"]) {
      assert.match(
        html,
        new RegExp(
          `href="/${path}\\?returnTo=%2Finvitations&amp;intent=coach"`,
        ),
      );
    }
    if (purpose === "confirmation") {
      assert.match(html, /Already have a verified account\?/);
      assert.match(html, /Sign in to your account/);
      assert.match(html, /Resend confirmation email/);
    } else {
      assert.match(html, /Resend reset link/);
      assert.doesNotMatch(html, /Resend confirmation email/);
    }
  }
});

test("recovery sessions never see ordinary credential entry or profile completion", () => {
  const recovery: AuthSessionSnapshot = { status: "recovery-required" };
  for (const stage of ["sign-in", "register", "complete-profile"] as const) {
    const html = screen(stage, recovery);
    assert.match(html, /Finish resetting your password before continuing/);
    assert.match(html, /href="\/reset-password"/);
    assert.doesNotMatch(html, /name="password"|name="username"/);
  }
  assert.match(screen("reset-password", recovery), /name="password"/);
  const missingProof = screen("reset-password");
  assert.match(missingProof, /Open a fresh reset link/);
  assert.doesNotMatch(missingProof, /name="password"/);
});

test("missing proof, resend and coach continuation remain safe public recovery paths", () => {
  const confirm = screen("confirm");
  assert.match(confirm, /This link is missing, expired or already used/);
  assert.doesNotMatch(confirm, /Continue securely/);
  const resend = screen("check-email");
  assert.match(resend, /<input[^>]*autoComplete="email"[^>]*name="email"/);
  assert.match(resend, /If this address is eligible/);
  const entry = screen("sign-in");
  assert.match(entry, /returnTo=%2F&amp;intent=coach/);
  const signedIn: AuthSessionSnapshot = {
    status: "signed-in",
    subject: "new-account",
    email: "fixture@users.movx.test",
    expiresAt: null,
  };
  const returning = screen("sign-in", signedIn);
  assert.match(returning, /You’re already signed in/);
  assert.match(
    returning,
    /href="\/complete-profile\?returnTo=%2F&amp;intent=coach"/,
  );
  assert.doesNotMatch(returning, /name="password"|Create account<\/button>/);
});
