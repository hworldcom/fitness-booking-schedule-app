import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  accountDetailsInput,
  isAccountResult,
  validBirthdate,
} from "@/account/contracts";
import {
  AccountSettingsView,
  formatBirthdate,
} from "@/features/account/account-settings";
import { AccountShell } from "@/components/account-shell";
import type { ActorSnapshot } from "@/auth/actor-contracts";

const input = {
  displayName: "Settings Athlete",
  birthdate: null,
  gender: null,
  revision: 0,
};
test("personal settings normalize names and optional gender without accepting authority or unknown fields", () => {
  assert.deepEqual(
    accountDetailsInput({
      ...input,
      displayName: "  Renée   Lee  ",
      gender: "  nonbinary  ",
    }),
    { ...input, displayName: "Renée Lee", gender: "nonbinary" },
  );
  assert.deepEqual(accountDetailsInput({ ...input, gender: "  " }), input);
  for (const value of [
    null,
    [],
    { ...input, profileId: "another-person" },
    { ...input, role: "coach" },
    { ...input, email: "other@example.test" },
    { ...input, displayName: "a" },
    { ...input, displayName: "x".repeat(81) },
    { ...input, displayName: "Name\nChanged" },
    { ...input, displayName: "Name\u200b" },
    { ...input, gender: "x".repeat(81) },
    { ...input, gender: "x\u0000" },
    { ...input, revision: -1 },
    { ...input, revision: 0.5 },
    { ...input, revision: 2147483648 },
  ])
    assert.equal(accountDetailsInput(value), null);
  assert.ok(
    accountDetailsInput({ ...input, displayName: "李明", gender: null }),
  );
});
test("birthdates reject impossible, future and out-of-range dates without timezone conversion", () => {
  for (const value of [null, "1900-01-01", "2000-02-29", "2026-10-17"])
    assert.ok(validBirthdate(value, "2026-10-17"));
  for (const value of [
    "2026-10-18",
    "2025-02-29",
    "2000-02-30",
    "1899-12-31",
    "2020-13-01",
    "2020-1-01",
    "",
    2000,
    "2000-01-01T00:00:00Z",
  ])
    assert.equal(validBirthdate(value, "2026-10-17"), false);
  assert.equal(formatBirthdate("2000-02-29"), "29 February 2000");
});
test("private response validation accepts database key order and rejects injected/unavailable personal data", () => {
  assert.ok(
    isAccountResult({
      status: "ready",
      details: {
        revision: 0,
        gender: null,
        birthdate: null,
        displayName: "Settings Athlete",
      },
    }),
  );
  for (const value of [
    { status: "ready", details: { ...input, email: "no@example.test" } },
    { status: "ready", details: { ...input, gender: "  " } },
    { status: "unavailable", details: input },
    { status: "ready", details: { ...input, birthdate: "3000-01-01" } },
  ])
    assert.equal(isAccountResult(value), false);
});
test("Account sections show current email-code security, static English and German Coming soon without photo editing", () => {
  const html = renderToStaticMarkup(
    createElement(
      AccountSettingsView,
      { email: "settings@example.test" },
      createElement("section", { id: "personal-details" }, "Personal details"),
    ),
  );
  for (const href of [
    "#personal-details",
    "#login-security",
    "#language",
    "/profile",
    "/sign-in?returnTo=%2Faccount",
  ])
    assert.ok(html.includes(`href="${href}"`));
  assert.match(html, /settings@example.test/);
  assert.match(html, /One-time email code/);
  assert.match(html, />English<\/dt>/);
  assert.match(html, /Current language/);
  assert.match(html, /lang="de">Deutsch<\/dt>/);
  assert.match(html, /Coming soon/);
  assert.doesNotMatch(
    html,
    /<select|<input|type="file"|Change password|billing|Steuern|Payments|<button/,
  );
});
test("Account has its own settings shell and personal menu across coach states, without workspace discovery chrome", () => {
  for (const coachAccessStatus of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const actor: ActorSnapshot = {
      status: "authorized",
      profile: {
        slug: "settings-athlete",
        displayName: "Settings Athlete",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: { slug: "settings-test", name: "Settings test" },
      role: "member",
      coachAccessStatus,
    };
    const html = renderToStaticMarkup(
      createElement(
        AccountShell,
        {
          actor,
          messageBadge: createElement("span", null, "3 unread"),
        },
        createElement("h1", null, "Account settings"),
      ),
    );
    for (const href of [
      "/",
      "/messages",
      "/account",
      "/sessions",
      "#main-content",
    ])
      assert.ok(html.includes(`href="${href}"`));
    assert.match(html, /3 unread/);
    assert.match(html, /aria-current="page"/);
    assert.doesNotMatch(
      html,
      /authenticated-sidebar|authenticated-mobile-nav|demo-strip|How it works|href="\/events"|href="\/explore"|<footer/,
    );
  }
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(
        AccountShell,
        {
          actor: { status },
          authControl: createElement("a", { href: "/sign-in" }, "Sign in"),
        },
        "Account settings",
      ),
    );
    assert.match(html, /href="\/sign-in"/);
    assert.doesNotMatch(
      html,
      /href="\/messages"|href="\/account"|href="\/sessions"/,
    );
  }
});
