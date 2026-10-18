import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  resolveWorkspaceView,
  workspaceViewForPath,
  workspaceViewStorageKey,
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
  ])
    assert.equal(resolveWorkspaceView(actor, path, "coach"), "athlete");
  for (const path of [
    "/",
    "/account",
    "/profile",
    "/messages",
    "/coaches/daniel-park",
    "/coach-other",
    "/sessions-other",
  ]) {
    assert.equal(workspaceViewForPath(path), null);
    assert.equal(resolveWorkspaceView(actor, path, "coach"), "coach");
    for (const bad of [null, undefined, "admin", "COACH", {}, "athlete"])
      assert.equal(resolveWorkspaceView(actor, path, bad), "athlete");
  }
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
