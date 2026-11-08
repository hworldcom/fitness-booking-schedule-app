import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { myCoachesSection } from "@/domain/my-coaches-navigation";
import { MyCoachesNavigation } from "@/features/connections/my-coaches-workspace";
import { myCoachesOwnerAccess } from "@/features/connections/my-coaches-model";

test("My coaches defaults to connected and exposes exactly two stable URL-backed sections", () => {
  for (const value of [
    undefined,
    "connected",
    "external",
    "unknown",
    ["requests", "requests"],
  ])
    assert.equal(myCoachesSection(value), "connected");
  assert.equal(myCoachesSection("requests"), "requests");
  for (const active of ["connected", "requests"] as const) {
    const html = renderToStaticMarkup(
      createElement(MyCoachesNavigation, { active }),
    );
    assert.deepEqual(
      [...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
      ["/my-coaches", "/my-coaches?section=requests"],
    );
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.ok(
      html.indexOf("Connected coaches") < html.indexOf("Connection requests"),
    );
    assert.doesNotMatch(html, /External/);
  }
});

const actor: ActorSnapshot = {
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
const session: AuthSessionSnapshot = {
  status: "signed-in",
  subject: "21200000-0000-4000-8000-000000000001",
  email: "athlete@example.test",
  expiresAt: null,
};
const expected = {
  subject: session.subject,
  actorIdentity: "athlete-one:run-one:member",
};
test("My coaches binds the server owner while retaining athlete capability across coach application states", () => {
  for (const status of [
    "not-applied",
    "pending",
    "approved",
    "demo",
    "rejected",
    "suspended",
  ] as const)
    assert.equal(
      myCoachesOwnerAccess(
        session,
        { ...actor, coachAccessStatus: status },
        expected,
      ),
      "allowed",
    );
  assert.equal(
    myCoachesOwnerAccess({ ...session, subject: "another" }, actor, expected),
    "denied",
  );
  assert.equal(
    myCoachesOwnerAccess(
      session,
      { ...actor, profile: { ...actor.profile, slug: "another" } },
      expected,
    ),
    "denied",
  );
  assert.equal(
    myCoachesOwnerAccess(
      session,
      { ...actor, demoRun: { ...actor.demoRun, slug: "another" } },
      expected,
    ),
    "denied",
  );
  assert.equal(
    myCoachesOwnerAccess(session, { ...actor, role: "operator" }, expected),
    "denied",
  );
  assert.equal(
    myCoachesOwnerAccess({ status: "unavailable" }, actor, expected),
    "pending",
  );
  assert.equal(
    myCoachesOwnerAccess(session, { status: "unavailable" }, expected),
    "pending",
  );
  assert.equal(
    myCoachesOwnerAccess(
      { status: "signed-out" },
      { status: "unavailable" },
      expected,
    ),
    "denied",
  );
  for (const status of ["signed-out", "forbidden", "preview"] as const)
    assert.equal(myCoachesOwnerAccess(session, { status }, expected), "denied");
});
