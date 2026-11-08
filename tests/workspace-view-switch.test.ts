import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { WorkspaceViewSwitch } from "@/components/workspace-view-switch";
import { WorkspaceNavigationItems } from "@/components/workspace-navigation";
import { navigationForActor } from "@/components/shell";

const actor: Extract<ActorSnapshot, { status: "authorized" }> = {
  status: "authorized",
  profile: {
    slug: "switch-coach",
    displayName: "Switch Coach",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "switch-run", name: "Switch Run" },
  role: "member",
  coachAccessStatus: "approved",
};

test("navigation switch reuses existing eligibility, including suspended resolution access", () => {
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(WorkspaceViewSwitch, {
        actor: { ...actor, coachAccessStatus: status },
        pathname: "/sessions",
        view: "athlete",
      }),
    );
    assert.equal(
      html.includes("Switch to coach view"),
      ["approved", "demo", "suspended"].includes(status),
    );
  }
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const)
    assert.equal(
      renderToStaticMarkup(
        createElement(WorkspaceViewSwitch, {
          actor: { status },
          pathname: "/coach",
          view: "coach",
        }),
      ),
      "",
    );
});

test("the opposite view follows explicit routes instead of a stale preference and keeps existing Profile semantics", () => {
  for (const [pathname, view, label, href] of [
    ["/sessions", "coach", "coach", "/coach"],
    ["/sessions/calendar", "coach", "coach", "/coach"],
    ["/my-coaches", "athlete", "coach", "/coach"],
    ["/coach", "athlete", "athlete", "/sessions/calendar"],
    ["/coach/athletes", "athlete", "athlete", "/sessions/calendar"],
    ["/profile", "coach", "coach", "/profile/coach"],
    ["/profile/coach", "athlete", "athlete", "/profile"],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(WorkspaceViewSwitch, { actor, pathname, view }),
    );
    assert.match(html, new RegExp(`Switch to ${label} view`));
    assert.ok(html.includes(`href="${href}"`));
    assert.doesNotMatch(html, /aria-current|aria-pressed/);
  }
});

test("desktop and mobile navigation keep one current destination and the switch last after a horizontal separator", () => {
  for (const mobile of [false, true])
    for (const pathname of ["/coach/athletes", "/my-coaches"]) {
      const html = renderToStaticMarkup(
        createElement(
          "nav",
          null,
          createElement(WorkspaceNavigationItems, {
            navigation: navigationForActor(actor, pathname),
            pathname,
            mobile,
            viewValues: [],
          }),
          createElement(WorkspaceViewSwitch, {
            actor,
            pathname,
            view: "athlete",
          }),
        ),
      );
      const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)];
      assert.equal(
        links.at(-1)?.[1],
        pathname.startsWith("/coach") ? "/sessions/calendar" : "/coach",
      );
      assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
      assert.equal((html.match(/<hr/g) ?? []).length, 1);
      assert.ok(html.indexOf("<hr") > html.indexOf('aria-current="page"'));
      assert.ok(html.indexOf("<hr") < html.lastIndexOf("<a "));
    }
});
