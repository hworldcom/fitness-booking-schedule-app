import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { MessageShell } from "@/components/shell";
import type { CoachAccessStatus } from "@/domain/coaches";

function actor(coachAccessStatus: CoachAccessStatus): ActorSnapshot {
  return {
    status: "authorized",
    profile: {
      slug: "message-athlete",
      displayName: "Message Athlete",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "message-shell-test", name: "Message shell test" },
    role: "member",
    coachAccessStatus,
  };
}
function render(value: ActorSnapshot) {
  return renderToStaticMarkup(
    createElement(
      MessageShell,
      {
        actor: value,
        authControl: createElement("a", { href: "/sign-in" }, "Sign in"),
      },
      createElement("h1", null, "Conversation workspace"),
    ),
  );
}
test("dedicated messages keep an athlete return and personal account without ordinary workspace chrome", () => {
  for (const status of ["not-applied", "pending", "rejected"] as const) {
    const html = render(actor(status));
    assert.match(html, /href="\/sessions"/);
    assert.match(html, /href="\/account"/);
    assert.match(html, /aria-label="MovX Club home"/);
    assert.match(html, /href="#main-content"/);
    assert.match(html, /id="main-content"/);
    assert.match(html, /Conversation workspace/);
    assert.doesNotMatch(
      html,
      /href="\/coach"|href="\/explore"|How it works|demo-strip|<footer|authenticated-mobile-nav|authenticated-sidebar/,
    );
  }
});
test("coach-capable message accounts return to their workspace with a personal Account/My sessions dropdown", () => {
  for (const status of ["approved", "demo", "suspended"] as const) {
    const html = render(actor(status));
    assert.match(html, /href="\/coach"/);
    assert.match(html, /aria-label="Back to Coach workspace"/);
    assert.match(html, /href="\/account"/);
    assert.match(html, /aria-label="Account menu for Message Athlete"/);
    assert.match(html, /href="\/sessions"/);
    assert.doesNotMatch(html, /href="\/profile\/coach"/);
  }
});
test("unauthorized message shells expose sign-in and Home without fabricated private destinations", () => {
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    const html = render({ status });
    assert.match(html, /href="\/sign-in"/);
    assert.match(html, /aria-label="MovX Club home"/);
    assert.doesNotMatch(
      html,
      /href="\/sessions"|href="\/coach"|href="\/account"|Message Athlete/,
    );
  }
});
