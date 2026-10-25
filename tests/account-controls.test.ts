import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { accountDetailsInput } from "@/account/contracts";
import { HeaderAccountControl } from "@/components/header-account-control";
import { AccountGenderField } from "@/features/account/account-gender-field";

test("gender offers optional Male/Female choices with the stored selection", () => {
  for (const value of [null, "Male", "Female"]) {
    const html = renderToStaticMarkup(
      createElement(AccountGenderField, { value, onChange: () => {} }),
    );
    assert.match(html, /<select name="gender" autoComplete="sex">/);
    assert.doesNotMatch(html, /<input|<textarea|required=/);
    assert.equal((html.match(/<option /g) ?? []).length, 3);
    assert.match(html, /Not provided<\/option>/);
    assert.match(html, /Male<\/option>/);
    assert.match(html, /Female<\/option>/);
    const selected = [...html.matchAll(/<option value="([^"]*)" selected=""/g)];
    assert.deepEqual(
      selected.map((option) => option[1]),
      [value ?? ""],
    );
    const command = {
      section: "personal-details",
      legalName: null,
      preferredFirstName: null,
      birthdate: null,
      gender: value,
      revision: 0,
    };
    assert.deepEqual(accountDetailsInput(command), command);
  }
});

test("legacy gender remains selected without allowing new free-text input", () => {
  const html = renderToStaticMarkup(
    createElement(AccountGenderField, {
      value: "Previously supplied",
      onChange: () => {},
    }),
  );
  assert.match(
    html,
    /<option value="Previously supplied" disabled="" selected="">Previously supplied \(previously entered\)<\/option>/,
  );
  assert.match(html, /kept until you choose a new option or clear it/);
  assert.doesNotMatch(html, /<input|<textarea/);
});

const baseActor = {
  status: "authorized",
  profile: {
    slug: "control-test",
    displayName: "Control Test",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "control-test-run", name: "Control test run" },
  role: "member",
} as const;

test("authorized athlete and coach headers render only the account dropdown", () => {
  for (const coachAccessStatus of [
    "not-applied",
    "approved",
    "demo",
    "suspended",
  ] as const)
    for (const pathname of [
      "/sessions",
      "/profile",
      "/coach",
      "/profile/coach",
      "/",
    ]) {
      const actor: ActorSnapshot = { ...baseActor, coachAccessStatus };
      const html = renderToStaticMarkup(
        createElement(HeaderAccountControl, {
          actor,
          pathname,
          authControl: createElement(
            "a",
            { href: "/sign-in" },
            "Auth fallback",
          ),
        }),
      );
      assert.equal((html.match(/<button /g) ?? []).length, 1);
      assert.equal((html.match(/href="\/account"/g) ?? []).length, 1);
      assert.match(
        html,
        pathname === "/profile/coach" && coachAccessStatus !== "not-applied"
          ? /href="\/profile"/
          : /href="\/sessions"/,
      );
      assert.doesNotMatch(html, /Auth fallback|href="\/sign-in"/);
    }
});

test("unauthorized headers preserve recovery and disclose no account menu", () => {
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(HeaderAccountControl, {
        actor: { status },
        pathname: "/sessions",
        authControl: createElement("a", { href: "/sign-in" }, "Auth fallback"),
      }),
    );
    assert.equal(html, '<a href="/sign-in">Auth fallback</a>');
  }
});
