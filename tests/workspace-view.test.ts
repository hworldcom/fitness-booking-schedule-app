import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  resolveWorkspaceView,
  workspaceViewForPath,
  workspaceViewStorageKey,
  workspaceProfileHref,
  workspaceSwitchHref,
} from "@/auth/workspace-view";
const actor: ActorSnapshot = {
  status: "authorized",
  profile: {
    slug: "coach-one",
    displayName: "Coach One",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "cohort-one", name: "Cohort One" },
  role: "member",
  coachAccessStatus: "approved",
};
test("explicit private routes override preferences; neutral public pages use only valid preferences", () => {
  for (const path of ["/coach", "/coach/events/one", "/profile/coach"])
    assert.equal(resolveWorkspaceView(actor, path, "athlete"), "coach");
  for (const path of [
    "/sessions",
    "/sessions/groups/one",
    "/my-coaches/history",
    "/profile",
    "/profile/details",
  ])
    assert.equal(resolveWorkspaceView(actor, path, "coach"), "athlete");
  for (const path of [
    "/",
    "/account",
    "/messages",
    "/coaches/daniel-park",
    "/coach-other",
    "/sessions-other",
    "/profile-other",
  ]) {
    assert.equal(workspaceViewForPath(path), null);
    assert.equal(resolveWorkspaceView(actor, path, "coach"), "coach");
    for (const bad of [null, undefined, "admin", "COACH", {}, "athlete"])
      assert.equal(resolveWorkspaceView(actor, path, bad), "athlete");
  }
});
test("Profile switches keep context in both directions and route selection survives stale preferences", () => {
  for (const status of ["approved", "demo"] as const) {
    const coach: ActorSnapshot = { ...actor, coachAccessStatus: status };
    assert.equal(
      workspaceSwitchHref(coach, "/profile", "coach"),
      "/profile/coach",
    );
    assert.equal(
      workspaceSwitchHref(coach, "/profile/coach", "athlete"),
      "/profile",
    );
    assert.equal(
      workspaceSwitchHref(coach, "/profile/coach/edit", "athlete"),
      "/profile",
    );
    assert.equal(resolveWorkspaceView(coach, "/profile", "coach"), "athlete");
    assert.equal(
      resolveWorkspaceView(coach, "/profile/coach", "athlete"),
      "coach",
    );
    for (const path of [
      "/coach",
      "/coach/events",
      "/account",
      "/messages",
      "/",
    ])
      assert.equal(
        workspaceProfileHref(coach, resolveWorkspaceView(coach, path, "coach")),
        "/profile/coach",
      );
    assert.equal(workspaceProfileHref(coach, "athlete"), "/profile");
  }
});
test("outside Profile the switch retains workspace defaults and strict segment boundaries", () => {
  for (const path of [
    "/coach",
    "/sessions",
    "/account",
    "/messages",
    "/profile-other",
    "/coaches/example",
    "/",
  ]) {
    assert.equal(workspaceSwitchHref(actor, path, "coach"), "/coach");
    assert.equal(workspaceSwitchHref(actor, path, "athlete"), "/sessions");
  }
});
test("Profile destinations do not expose editing to suspended, applicant or unauthorized actors", () => {
  const suspended: ActorSnapshot = { ...actor, coachAccessStatus: "suspended" };
  assert.equal(workspaceProfileHref(suspended, "coach"), "/profile");
  assert.equal(workspaceSwitchHref(suspended, "/profile", "coach"), "/coach");
  assert.equal(
    workspaceSwitchHref(suspended, "/profile/coach", "athlete"),
    "/profile",
  );
  for (const status of ["not-applied", "pending", "rejected"] as const) {
    const ordinary: ActorSnapshot = { ...actor, coachAccessStatus: status };
    assert.equal(workspaceProfileHref(ordinary, "coach"), "/profile");
    assert.equal(
      workspaceSwitchHref(ordinary, "/profile", "coach"),
      "/profile",
    );
    assert.equal(
      workspaceSwitchHref(ordinary, "/account", "coach"),
      "/sessions",
    );
  }
  for (const status of [
    "signed-out",
    "unavailable",
    "forbidden",
    "preview",
  ] as const)
    assert.equal(workspaceProfileHref({ status }, "coach"), "/profile");
});
test("stored coach preference cannot elevate an ordinary, unapproved or signed-out account", () => {
  for (const status of ["not-applied", "pending", "rejected"] as const) {
    const ordinary: ActorSnapshot = { ...actor, coachAccessStatus: status };
    assert.equal(resolveWorkspaceView(ordinary, "/coach", "coach"), "athlete");
    assert.equal(workspaceViewStorageKey(ordinary), null);
  }
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    assert.equal(
      resolveWorkspaceView({ status }, "/coach", "coach"),
      "athlete",
    );
    assert.equal(workspaceViewStorageKey({ status }), null);
  }
});
test("browser preference keys isolate account and dataset changes", () => {
  const key = workspaceViewStorageKey(actor);
  assert.ok(key);
  assert.notEqual(
    key,
    workspaceViewStorageKey({
      ...actor,
      profile: { ...actor.profile, slug: "coach-two" },
    }),
  );
  assert.notEqual(
    key,
    workspaceViewStorageKey({
      ...actor,
      demoRun: { ...actor.demoRun, slug: "cohort-two" },
    }),
  );
});
