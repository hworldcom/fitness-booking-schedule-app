import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { AccountMenu } from "@/components/account-menu";
import {
  hasCoachWorkspace,
  resolveWorkspaceView,
  workspaceHref,
} from "@/auth/workspace-view";
import type { CoachAccessStatus } from "@/domain/coaches";

function actor(coachAccessStatus: CoachAccessStatus): ActorSnapshot {
  return {
    status: "authorized",
    profile: {
      slug: "menu-athlete",
      displayName: "Menu Athlete",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "menu-test", name: "Menu test" },
    role: "member",
    coachAccessStatus,
  };
}
function render(value: ActorSnapshot, pathname = "/") {
  return renderToStaticMarkup(
    createElement(AccountMenu, { actor: value, pathname }),
  );
}

test("account dropdown exposes no private identity or links to unauthorized actors", () => {
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const)
    assert.equal(render({ status }), "");
});

test("dropdown names Trainings and follows the selected capability-bounded view", () => {
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const value = actor(status);
    for (const path of [
      "/",
      "/sessions/groups",
      "/coach",
      "/profile",
      "/profile/coach",
    ]) {
      const view = resolveWorkspaceView(value, path);
      const profileHref =
        view === "coach" && status !== "suspended"
          ? "/profile/coach"
          : "/profile";
      const html = render(value, path);
      assert.match(
        html,
        /<button[^>]*aria-label="Account menu for Menu Athlete"/,
      );
      assert.match(html, /aria-expanded="false"/);
      const controlled = /aria-controls="([^"]+)"/.exec(html)?.[1];
      assert.ok(controlled);
      assert.ok(
        html.includes(
          `id="${controlled}" class="account-menu-panel" hidden=""`,
        ),
      );
      assert.deepEqual(
        [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
        [
          profileHref,
          workspaceHref(view),
          "/account",
          ...(hasCoachWorkspace(value)
            ? [
                path === "/profile/coach"
                  ? "/profile"
                  : path === "/profile" && status !== "suspended"
                    ? "/profile/coach"
                    : workspaceHref(view === "coach" ? "athlete" : "coach"),
              ]
            : []),
        ],
      );
      assert.match(html, />Profile<\/span>/);
      assert.match(html, />Trainings<\/span>/);
      assert.match(html, />Account settings<\/span>/);
      assert.doesNotMatch(html, /My training|role="menu"|role="menuitem"/);
      if (hasCoachWorkspace(value))
        assert.match(
          html,
          new RegExp(
            `Switch to ${view === "coach" ? "athlete" : "coach"} view`,
          ),
        );
      else assert.doesNotMatch(html, /Switch to|href="\/coach"/);
      if (path === "/coach" && view === "coach")
        assert.match(html, /aria-current="page"[^>]*href="\/coach"/);
    }
  }
});

test("coach Profile entry and Profile view switches use their own pages, while Trainings keeps its workspace", () => {
  const hrefs = (html: string) =>
    [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const status of ["approved", "demo"] as const) {
    assert.deepEqual(hrefs(render(actor(status), "/coach")), [
      "/profile/coach",
      "/coach",
      "/account",
      "/sessions/calendar",
    ]);
    assert.deepEqual(hrefs(render(actor(status), "/profile/coach")), [
      "/profile/coach",
      "/coach",
      "/account",
      "/profile",
    ]);
    assert.deepEqual(hrefs(render(actor(status), "/profile")), [
      "/profile",
      "/sessions/calendar",
      "/account",
      "/profile/coach",
    ]);
  }
  assert.deepEqual(hrefs(render(actor("suspended"), "/profile")), [
    "/profile",
    "/sessions/calendar",
    "/account",
    "/coach",
  ]);
});

test("account trigger preserves private-avatar preference, portrait fallback, initials and escaped identity", () => {
  const value = actor("approved");
  assert.equal(value.status, "authorized");
  if (value.status !== "authorized") return;
  const portrait = "/images/coaches/daniel-park.webp";
  const own = "/api/profile/avatar?v=2026-10-17T12%3A00%3A00Z";
  const uploaded = render({
    ...value,
    profile: { ...value.profile, avatarUrl: own, coachPortraitUrl: portrait },
  });
  assert.ok(uploaded.includes(`src="${own}"`));
  assert.ok(!uploaded.includes(portrait));
  assert.ok(
    render({
      ...value,
      profile: { ...value.profile, coachPortraitUrl: portrait },
    }).includes(`src="${portrait}"`),
  );
  assert.match(render(value), />MA<\/span>/);
  const escaped = render({
    ...value,
    profile: { ...value.profile, displayName: '<script>"Name"</script>' },
  });
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
});
