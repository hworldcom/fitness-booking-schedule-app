import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  isNavigationHrefActive,
  isPublicMarketplacePath,
  mobileNavigationForActor,
  navigationForActor,
  publicAccountNavigationForActor,
  workspaceRoleLabel,
} from "@/components/shell";
import type { CoachAccessStatus } from "@/domain/coaches";

const PUBLIC_PATHS = ["/", "/explore", "/events", "/how-it-works", "/profile"];

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
        { label: "Events", href: "/events" },
        { label: "My sessions", href: "/sessions" },
        { label: "Messages", href: "/messages" },
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
        { label: "Events", href: "/events" },
        { label: "My sessions", href: "/sessions" },
        { label: "Messages", href: "/messages" },
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
      { label: "Events", href: "/events" },
      { label: "My sessions", href: "/sessions" },
      { label: "Messages", href: "/messages" },
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
  const actor = authorizedActor("approved");
  for (const path of ["/coach", "/coach/events/example", "/profile/coach"]) {
    assert.deepEqual(
      navigationForActor(actor, path).map(({ href }) => href),
      ["/", "/sessions", "/messages", "/coach", "/profile/coach"],
      path,
    );
  }
  for (const path of ["/coaches/daniel-park", "/profile", "/sessions"]) {
    assert.deepEqual(
      navigationForActor(actor, path),
      navigationForActor(actor),
    );
  }
  assert.deepEqual(
    navigationForActor({ status: "signed-out" }, "/coach").map(
      ({ href }) => href,
    ),
    ["/", "/profile"],
  );
});

test("public shell mode is restricted to the adopted marketplace routes", () => {
  for (const path of [
    "/",
    "/explore",
    "/events",
    "/events/group-00000000000040008000000000000001",
    "/coaches/daniel-park",
    "/how-it-works",
    "/sign-in",
  ]) {
    assert.equal(isPublicMarketplacePath(path), true, path);
  }

  for (const path of [
    "/coaches",
    "/coaches/daniel-park/schedule",
    "/sessions",
    "/sessions/groups",
    "/events/example/nested",
    "/coach",
    "/profile",
    "/profile/coach",
  ]) {
    assert.equal(isPublicMarketplacePath(path), false, path);
  }
});

test("public account controls expose only authorized private destinations", () => {
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    assert.deepEqual(publicAccountNavigationForActor({ status }), []);
  }
  assert.deepEqual(
    publicAccountNavigationForActor(authorizedActor("not-applied")).map(
      ({ href }) => href,
    ),
    ["/sessions", "/messages"],
  );
  assert.deepEqual(
    publicAccountNavigationForActor(authorizedActor("approved")).map(
      ({ href }) => href,
    ),
    ["/sessions", "/messages", "/coach"],
  );
  assert.deepEqual(
    publicAccountNavigationForActor(authorizedActor("demo")).map(
      ({ href }) => href,
    ),
    ["/sessions", "/messages", "/coach"],
  );
  assert.deepEqual(
    publicAccountNavigationForActor(authorizedActor("suspended")).map(
      ({ href }) => href,
    ),
    ["/sessions", "/messages", "/coach"],
  );
});

test("mobile workspace navigation stays bounded to primary private destinations", () => {
  assert.deepEqual(
    mobileNavigationForActor({ status: "preview" }).map(({ href }) => href),
    ["/explore", "/profile"],
  );
  assert.deepEqual(
    mobileNavigationForActor(authorizedActor("not-applied")).map(
      ({ label, href }) => ({ label, href }),
    ),
    [
      { label: "Explore", href: "/explore" },
      { label: "My sessions", href: "/sessions" },
      { label: "Messages", href: "/messages" },
      { label: "Profile", href: "/profile" },
    ],
  );
  assert.deepEqual(
    mobileNavigationForActor(authorizedActor("approved")).map(
      ({ label, href }) => ({ label, href }),
    ),
    [
      { label: "Explore", href: "/explore" },
      { label: "My sessions", href: "/sessions" },
      { label: "Messages", href: "/messages" },
      { label: "Coach workspace", href: "/coach" },
      { label: "Profile", href: "/profile/coach" },
    ],
  );
  for (const status of ["approved", "demo", "suspended"] as const) {
    for (const path of ["/coach", "/coach/events", "/profile/coach"]) {
      assert.deepEqual(
        mobileNavigationForActor(authorizedActor(status), path).map(
          ({ label, href }) => ({ label, href }),
        ),
        [
          { label: "Home", href: "/" },
          { label: "My sessions", href: "/sessions" },
          { label: "Messages", href: "/messages" },
          { label: "Coach workspace", href: "/coach" },
          {
            label: "Profile",
            href: status === "suspended" ? "/profile" : "/profile/coach",
          },
        ],
        `${status}: ${path}`,
      );
    }
  }
});

test("authenticated workspace role copy reflects capability without granting it", () => {
  assert.equal(workspaceRoleLabel({ status: "signed-out" }), "MovX preview");
  assert.equal(
    workspaceRoleLabel(authorizedActor("not-applied")),
    "Athlete account",
  );
  assert.equal(
    workspaceRoleLabel(authorizedActor("approved")),
    "Coach and athlete",
  );
  assert.equal(
    workspaceRoleLabel(authorizedActor("suspended")),
    "Coach access limited",
  );
});
