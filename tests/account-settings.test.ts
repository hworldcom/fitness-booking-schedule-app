import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  accountDetailsInput,
  defaultFirstName,
  isAccountResult,
  normalizeUsername,
  preferredChatName,
  validBirthdate,
  type AccountDetails,
  type PersonalDetailsInput,
} from "@/account/contracts";
import {
  ACCOUNT_SECTIONS,
  accountSection,
  accountSectionHref,
} from "@/account/sections";
import {
  AccountSettingsView,
  formatBirthdate,
} from "@/features/account/account-settings";
import {
  accountEditInput,
  advanceOtherDraft,
} from "@/features/account/account-settings-model";
import { AccountShell } from "@/components/account-shell";
import type { ActorSnapshot } from "@/auth/actor-contracts";

const input: PersonalDetailsInput = {
  section: "personal-details",
  legalName: null,
  preferredFirstName: null,
  birthdate: null,
  gender: null,
  revision: 0,
};
const details: AccountDetails = {
  displayName: "Legacy Person",
  legalName: "Morgan Private Legal",
  preferredFirstName: null,
  username: "reserved_login",
  birthdate: null,
  gender: null,
  revision: 0,
};

test("personal input separates private legal name from a nonunique preferred chat first name", () => {
  assert.deepEqual(
    accountDetailsInput({
      ...input,
      legalName: "  Renée   Lee  ",
      preferredFirstName: "  Ray  ",
      gender: "  nonbinary  ",
    }),
    {
      ...input,
      legalName: "Renée Lee",
      preferredFirstName: "Ray",
      gender: "nonbinary",
    },
  );
  assert.deepEqual(
    accountDetailsInput({
      ...input,
      legalName: "  ",
      preferredFirstName: "  ",
      gender: "  ",
    }),
    input,
  );
  for (const value of [
    null,
    [],
    { ...input, profileId: "another-person" },
    { ...input, username: "hidden_change" },
    { ...input, displayName: "Public Rename" },
    { ...input, legalName: "a" },
    { ...input, preferredFirstName: "x".repeat(81) },
    { ...input, legalName: "Name\nChanged" },
    { ...input, preferredFirstName: "Name\u200b" },
    { ...input, gender: "x\u0000" },
    { ...input, revision: -1 },
    { ...input, revision: 0.5 },
    { ...input, revision: 2147483648 },
  ])
    assert.equal(accountDetailsInput(value), null);
  assert.ok(
    accountDetailsInput({
      ...input,
      legalName: "李明",
      preferredFirstName: "李",
    }),
  );
});
test("preferred first name uses explicit preference then first legal-name word then retained name without treating it as legal identity", () => {
  assert.equal(preferredChatName(details), "Morgan");
  assert.equal(
    preferredChatName({ ...details, preferredFirstName: "Morgan Lee" }),
    "Morgan Lee",
  );
  assert.equal(preferredChatName({ ...details, legalName: null }), "Legacy");
  assert.equal(
    defaultFirstName("  Mary   Jane Smith ", "Legacy Person"),
    "Mary",
  );
});
test("login username normalizes independently and rejects invalid or authority-bearing writes", () => {
  for (const value of [" Morgan_1 ", "@MORGAN_1"])
    assert.equal(normalizeUsername(value), "morgan_1");
  for (const value of [null, "  "])
    assert.equal(normalizeUsername(value), null);
  for (const value of [
    "ab",
    "1morgan",
    "a-b",
    "two words",
    "@",
    "@@morgan",
    "äbc",
    "x".repeat(31),
    true,
  ])
    assert.equal(normalizeUsername(value), undefined);
  const login = {
    section: "login-security",
    username: "  Reserve_Me ",
    revision: 0,
  };
  assert.deepEqual(accountDetailsInput(login), {
    ...login,
    username: "reserve_me",
  });
  assert.equal(
    accountDetailsInput({ ...login, legalName: "Hidden Update" }),
    null,
  );
  assert.equal(
    accountDetailsInput({ ...login, email: "private@example.test" }),
    null,
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
test("strict account responses accept key order but reject extra fields, unnormalized names and private-data error payloads", () => {
  assert.ok(
    isAccountResult({
      status: "ready",
      details: {
        revision: 0,
        username: "reserved_login",
        gender: null,
        birthdate: null,
        preferredFirstName: null,
        legalName: "Morgan Private Legal",
        displayName: "Legacy Person",
      },
    }),
  );
  assert.ok(isAccountResult({ status: "username-taken" }));
  for (const value of [
    { status: "ready", details: { ...details, email: "no@example.test" } },
    { status: "ready", details: { ...details, legalName: "  Morgan  " } },
    { status: "ready", details: { ...details, username: "UPPER" } },
    { status: "conflict", details },
    { status: "ready", details: { ...details, birthdate: "3000-01-01" } },
  ])
    assert.equal(isAccountResult(value), false);
});
test("exactly the selected settings panel renders, with active query navigation and existing security/language scope", () => {
  for (const section of ACCOUNT_SECTIONS) {
    const html = renderToStaticMarkup(
      createElement(AccountSettingsView, {
        email: "settings@example.test",
        section,
        personalDetails: createElement(
          "section",
          { id: "personal-details" },
          "Private legal details",
        ),
        usernameSettings: createElement(
          "p",
          null,
          "Username reserved for future use",
        ),
        authenticationSettings: createElement(
          "p",
          null,
          "Sign-in security controls",
        ),
      }),
    );
    for (const target of ACCOUNT_SECTIONS)
      assert.ok(html.includes(`href="${accountSectionHref(target)}"`));
    assert.equal([...html.matchAll(/<section /g)].length, 1);
    assert.ok(html.includes(`id="${section}"`));
    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
    assert.match(html, /href="\/profile"/);
    assert.doesNotMatch(
      html,
      /href="#personal-details"|href="#login-security"|href="#language"|type="file"|Change password|<select/,
    );
    assert.equal(
      html.includes("Private legal details"),
      section === "personal-details",
    );
    assert.equal(
      html.includes("settings@example.test"),
      section === "login-security",
    );
    assert.equal(
      html.includes("Sign-in security controls"),
      section === "login-security",
    );
    assert.equal(
      html.includes("Username reserved for future use"),
      section === "login-security",
    );
    assert.equal(html.includes("Coming soon"), section === "language");
    if (section === "language") assert.match(html, /lang="de">Deutsch<\/dt>/);
  }
});
test("untrusted or repeated section inputs safely default to Personal details", () => {
  for (const value of [
    null,
    undefined,
    "",
    "profile",
    ["language"],
    ["language", "login-security"],
    "https://outside.test",
    { section: "language" },
  ])
    assert.equal(accountSection(value), "personal-details");
  for (const value of ACCOUNT_SECTIONS)
    assert.equal(accountSection(value), value);
});
test("separate section commands do not include hidden private edits, and own-save rebasing never advances stale drafts", () => {
  const personal = accountEditInput(details, "personal-details");
  const login = accountEditInput(details, "login-security");
  assert.ok(!("username" in personal));
  assert.ok(!("legalName" in login));
  assert.deepEqual(advanceOtherDraft(personal, login, 1), {
    ...personal,
    revision: 1,
  });
  assert.equal(
    advanceOtherDraft(
      { ...personal, revision: 0 },
      { ...login, revision: 1 },
      2,
    ).revision,
    0,
  );
  assert.equal(advanceOtherDraft(personal, personal, 1), personal);
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
      "/sessions/calendar",
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
      /href="\/messages"|href="\/account"|href="\/sessions\/calendar"/,
    );
  }
});
