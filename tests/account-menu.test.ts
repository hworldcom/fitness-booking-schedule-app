import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { AccountMenu } from "@/components/account-menu";
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

test("athlete and coach dropdowns contain only the two personal destinations, initially hidden", () => {
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const html = render(actor(status), "/profile/coach");
    assert.match(
      html,
      /<button[^>]*aria-label="Account menu for Menu Athlete"/,
    );
    assert.match(html, /aria-expanded="false"/);
    const controlled = /aria-controls="([^"]+)"/.exec(html)?.[1];
    assert.ok(controlled);
    assert.ok(
      html.includes(`id="${controlled}" class="account-menu-panel" hidden=""`),
    );
    assert.deepEqual(
      [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
      ["/account", "/sessions"],
    );
    assert.match(html, /lucide-menu/);
    assert.match(html, />Account<|>Account<\/span>/);
    assert.match(html, />My sessions<\/span>/);
    assert.doesNotMatch(
      html,
      /href="\/profile\/coach"|href="\/coach"|role="menu"|role="menuitem"/,
    );
  }
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
