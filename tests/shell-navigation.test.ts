import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  isNavigationHrefActive,
  isPublicMarketplacePath,
  isProfilePath,
  mobileNavigationForActor,
  navigationForActor,
  publicAccountNavigationForActor,
  workspaceRoleLabel,
} from "@/components/shell";
import type { CoachAccessStatus } from "@/domain/coaches";

const PUBLIC_PATHS = ["/", "/explore", "/events", "/how-it-works"];

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

test("athlete view keeps Home first and unchanged private labels for every account", () => {
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const actor = authorizedActor(status);
    for (const path of [
      "",
      "/sessions/calendar",
      "/sessions/groups/example",
      "/my-coaches",
      "/my-coaches/history",
    ]) {
      const expected = [
        { label: "Home", href: "/" },
        { label: "My training", href: "/sessions/calendar" },
        { label: "My coaches", href: "/my-coaches" },
      ];
      assert.deepEqual(
        navigationForActor(actor, path, "athlete").map(({ label, href }) => ({
          label,
          href,
        })),
        expected,
      );
      assert.deepEqual(
        navigationForActor(actor, path),
        mobileNavigationForActor(actor, path),
      );
    }
  }
});

test("coach view exclusively exposes its existing authorized workspace", () => {
  for (const status of ["approved", "demo", "suspended"] as const) {
    for (const path of [
      "/coach",
      "/coach/events/example",
      "/coach/athletes",
      "/coach/athletes/example",
      "/profile/coach",
      "/profile/coach/edit",
    ]) {
      const expected = [
        { label: "Home", href: "/" },
        { label: "Schedule", href: "/coach" },
        { label: "Bookings", href: "/coach?view=bookings" },
        { label: "My athletes", href: "/coach/athletes" },
        { label: "Events", href: "/coach/events" },
      ];
      assert.deepEqual(
        navigationForActor(authorizedActor(status), path).map(
          ({ label, href }) => ({ label, href }),
        ),
        expected,
      );
      assert.deepEqual(
        mobileNavigationForActor(authorizedActor(status), path).map(
          ({ label, href }) => ({ label, href }),
        ),
        expected,
      );
    }
  }
  for (const status of ["not-applied", "pending", "rejected"] as const) {
    assert.deepEqual(
      navigationForActor(authorizedActor(status), "/coach", "coach").map(
        ({ href }) => href,
      ),
      ["/", "/sessions/calendar", "/my-coaches"],
    );
  }
});

test("workspace routes use exact segment boundaries without confusing public coaches", () => {
  assert.equal(isNavigationHrefActive("/coach", "/coach"), true);
  assert.equal(isNavigationHrefActive("/coach/events", "/coach"), true);
  assert.equal(isNavigationHrefActive("/coaches/daniel-park", "/coach"), false);
  const actor = authorizedActor("approved");
  for (const path of [
    "/coaches/daniel-park",
    "/coach-other",
    "/profile-other",
    "/profiles",
    "/sessions-other",
    "/my-coaches-other",
  ]) {
    assert.deepEqual(
      navigationForActor(actor, path),
      navigationForActor(actor),
    );
  }
  assert.deepEqual(
    navigationForActor({ status: "signed-out" }, "/coach").map(
      ({ href }) => href,
    ),
    ["/"],
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
    "/register",
    "/check-email",
    "/forgot-password",
    "/reset-password",
    "/complete-profile",
    "/auth/confirm",
  ]) {
    assert.equal(isPublicMarketplacePath(path), true, path);
  }

  for (const path of [
    "/coaches",
    "/coaches/daniel-park/schedule",
    "/sessions/calendar",
    "/sessions/groups",
    "/my-coaches",
    "/events/example/nested",
    "/coach",
    "/profile",
    "/profile/coach",
  ]) {
    assert.equal(isPublicMarketplacePath(path), false, path);
  }
});

test("public header follows the selected mode without granting coach capability", () => {
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const)
    assert.deepEqual(publicAccountNavigationForActor({ status }, "coach"), []);
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const) {
    const actor = authorizedActor(status);
    assert.deepEqual(
      publicAccountNavigationForActor(actor).map(({ href }) => href),
      ["/messages"],
    );
    assert.deepEqual(
      publicAccountNavigationForActor(actor, "coach").map(({ href }) => href),
      ["approved", "demo", "suspended"].includes(status)
        ? ["/messages", "/coach"]
        : ["/messages"],
    );
  }
});

test("unauthorized mobile preview retains public navigation", () => {
  assert.deepEqual(
    mobileNavigationForActor({ status: "preview" }).map(({ href }) => href),
    ["/explore", "/profile"],
  );
});

test("workspace role label describes the view and preserves pending/suspended notices", () => {
  assert.equal(workspaceRoleLabel({ status: "signed-out" }), "MovX preview");
  assert.equal(
    workspaceRoleLabel(authorizedActor("not-applied")),
    "Athlete view",
  );
  assert.equal(workspaceRoleLabel(authorizedActor("approved")), "Athlete view");
  assert.equal(
    workspaceRoleLabel(authorizedActor("approved"), "coach"),
    "Coach view",
  );
  assert.equal(
    workspaceRoleLabel(authorizedActor("suspended"), "coach"),
    "Coach access limited",
  );
  assert.equal(
    workspaceRoleLabel(authorizedActor("pending")),
    "Coach application pending",
  );
});

test("standalone Profile classification uses exact segment boundaries", () => {
  for (const path of ["/profile", "/profile/coach", "/profile/security"])
    assert.equal(isProfilePath(path), true, path);
  for (const path of [
    "/profile-other",
    "/profiles",
    "/coaches/person",
    "/account",
    "/coach",
  ])
    assert.equal(isProfilePath(path), false, path);
});
