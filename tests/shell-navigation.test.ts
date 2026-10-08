import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { isNavigationHrefActive, navigationForActor } from "@/components/shell";
import type { CoachAccessStatus } from "@/domain/coaches";

const PUBLIC_PATHS = ["/", "/explore", "/how-it-works", "/profile"];

function authorizedActor(coachAccessStatus: CoachAccessStatus): ActorSnapshot {
  return {
    status: "authorized",
    profile: {
      slug: "daniel-park",
      displayName: "Daniel Park",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: {
      slug: "local-foundation-2030",
      name: "Local foundation run",
    },
    role: "member",
    coachAccessStatus,
  };
}

test("personal sessions are omitted from every unauthorized shell state", () => {
  const states = ["preview", "signed-out", "forbidden", "unavailable"] as const;
  for (const status of states) {
    assert.deepEqual(
      navigationForActor({ status }).map(({ href }) => href),
      PUBLIC_PATHS,
    );
  }
});

test("client and unapproved applicant navigation includes personal sessions", () => {
  for (const status of ["not-applied", "pending", "rejected"] as const) {
    assert.deepEqual(
      navigationForActor(authorizedActor(status)).map(({ label, href }) => ({
        label,
        href,
      })),
      [
        { label: "Home", href: "/" },
        { label: "Explore", href: "/explore" },
        { label: "My sessions", href: "/sessions" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Profile", href: "/profile" },
      ],
    );
  }
});

test("approved and demo navigation defaults Profile to the coach editor", () => {
  for (const status of ["approved", "demo"] as const) {
    assert.deepEqual(
      navigationForActor(authorizedActor(status)).map(({ label, href }) => ({
        label,
        href,
      })),
      [
        { label: "Home", href: "/" },
        { label: "Explore", href: "/explore" },
        { label: "My sessions", href: "/sessions" },
        { label: "Coach workspace", href: "/coach" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Profile", href: "/profile/coach" },
      ],
    );
  }
});

test("suspended coach navigation keeps workspace and personal Profile", () => {
  assert.deepEqual(
    navigationForActor(authorizedActor("suspended")).map(({ label, href }) => ({
      label,
      href,
    })),
    [
      { label: "Home", href: "/" },
      { label: "Explore", href: "/explore" },
      { label: "My sessions", href: "/sessions" },
      { label: "Coach workspace", href: "/coach" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Profile", href: "/profile" },
    ],
  );
});

test("coach workspace active state does not match public coach profiles", () => {
  assert.equal(isNavigationHrefActive("/coach", "/coach"), true);
  assert.equal(isNavigationHrefActive("/coach/settings", "/coach"), true);
  assert.equal(isNavigationHrefActive("/coaches/daniel-park", "/coach"), false);
});
