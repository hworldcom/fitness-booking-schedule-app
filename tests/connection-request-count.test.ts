import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { isConnectionCountIdentity } from "@/domain/connection-request-count";
import { connectionCountIdentity } from "@/features/connections/connection-count-model";
import { connectionRequestCountLabel } from "@/features/connections/connection-request-count";

const actor: Extract<ActorSnapshot, { status: "authorized" }> = {
  status: "authorized",
  profile: {
    slug: "athlete-one",
    displayName: "Athlete One",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "run-one", name: "Run One" },
  role: "member",
  coachAccessStatus: "not-applied",
};
const session: Extract<AuthSessionSnapshot, { status: "signed-in" }> = {
  status: "signed-in",
  subject: "21300000-0000-4000-8000-000000000001",
  email: "count@example.test",
  expiresAt: null,
};

test("pending count owner identity separates account, profile, dataset and role without gating athlete capability", () => {
  const original = connectionCountIdentity(session, actor);
  assert.ok(isConnectionCountIdentity(original));
  for (const status of [
    "not-applied",
    "pending",
    "approved",
    "demo",
    "rejected",
    "suspended",
  ] as const)
    assert.equal(
      connectionCountIdentity(session, { ...actor, coachAccessStatus: status }),
      original,
    );
  for (const changed of [
    connectionCountIdentity(
      { ...session, subject: "21300000-0000-4000-8000-000000000002" },
      actor,
    ),
    connectionCountIdentity(session, {
      ...actor,
      profile: { ...actor.profile, slug: "another" },
    }),
    connectionCountIdentity(session, {
      ...actor,
      demoRun: { ...actor.demoRun, slug: "another" },
    }),
    connectionCountIdentity(session, { ...actor, role: "operator" }),
  ])
    assert.notEqual(changed, original);
  for (const status of [
    "unavailable",
    "signed-out",
    "preview",
    "forbidden",
  ] as const)
    assert.equal(connectionCountIdentity(session, { status }), null);
  assert.equal(connectionCountIdentity({ status: "unavailable" }, actor), null);
  assert.equal(connectionCountIdentity({ status: "signed-out" }, actor), null);
});

test("accessible count labels distinguish loading, unknown and verified zero or many incoming requests", () => {
  assert.equal(
    connectionRequestCountLabel({ status: "loading" }),
    "Connection requests, loading pending count",
  );
  assert.equal(
    connectionRequestCountLabel({ status: "unavailable" }),
    "Connection requests, pending count unavailable",
  );
  for (const value of [0, 1, 121])
    assert.equal(
      connectionRequestCountLabel({ status: "ready", value }),
      `Connection requests, ${value} pending incoming`,
    );
});
