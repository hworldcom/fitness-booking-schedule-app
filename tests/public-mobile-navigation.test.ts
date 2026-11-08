import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  isPublicBrowsingPath,
  isPublicMarketplacePath,
  shouldRenderMobileNavigation,
  mobileNavigationForActor,
} from "@/components/shell";

const actor: Extract<ActorSnapshot, { status: "authorized" }> = {
  status: "authorized",
  profile: {
    slug: "public-nav",
    displayName: "Public Nav",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "nav-run", name: "Nav Run" },
  role: "member",
  coachAccessStatus: "approved",
};
const browsing = [
  "/",
  "/explore",
  "/events",
  "/events/fixture",
  "/how-it-works",
  "/privacy",
  "/coaches/fixture",
  "/@fixture_coach",
];
const auth = [
  "/sign-in",
  "/register",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/complete-profile",
  "/auth/confirm",
];

test("public shell keeps exact browsing and Auth route boundaries while mobile browsing gets its own policy", () => {
  for (const path of browsing) {
    assert.equal(isPublicBrowsingPath(path), true, path);
    assert.equal(isPublicMarketplacePath(path), true, path);
  }
  for (const path of auth) {
    assert.equal(isPublicBrowsingPath(path), false, path);
    assert.equal(isPublicMarketplacePath(path), true, path);
  }
  for (const path of [
    "/coaches",
    "/coaches/fixture/edit",
    "/events/fixture/edit",
    "/privacy/other",
    "/explore-more",
    "/coach",
    "/sessions",
    "/@fixture_coach/edit",
  ]) {
    assert.equal(isPublicBrowsingPath(path), false, path);
    assert.equal(isPublicMarketplacePath(path), false, path);
  }
});

test("mobile website navigation requires an authorized actor and excludes Auth and standalone framings", () => {
  for (const coachAccessStatus of [
    "not-applied",
    "pending",
    "rejected",
    "approved",
    "demo",
    "suspended",
  ] as const)
    for (const path of browsing)
      assert.equal(
        shouldRenderMobileNavigation({ ...actor, coachAccessStatus }, path),
        true,
      );
  for (const status of [
    "preview",
    "signed-out",
    "unavailable",
    "forbidden",
  ] as const)
    for (const path of browsing)
      assert.equal(shouldRenderMobileNavigation({ status }, path), false);
  for (const path of [
    ...auth,
    "/account",
    "/profile",
    "/profile/coach",
    "/profile/coach/edit",
    "/messages",
  ])
    assert.equal(shouldRenderMobileNavigation(actor, path), false, path);
  for (const path of [
    "/coach",
    "/coach/athletes",
    "/sessions/calendar",
    "/my-coaches",
  ])
    for (const a of [actor, { status: "preview" } as const])
      assert.equal(shouldRenderMobileNavigation(a, path), true);
});

test("public bottom destinations retain the selected view without elevating ordinary accounts", () => {
  for (const path of browsing) {
    assert.deepEqual(
      mobileNavigationForActor(actor, path, "coach").map((x) => x.href),
      [
        "/",
        "/coach",
        "/coach?view=bookings",
        "/coach/athletes",
        "/coach/events",
      ],
    );
    for (const coachAccessStatus of [
      "not-applied",
      "pending",
      "rejected",
    ] as const)
      assert.deepEqual(
        mobileNavigationForActor(
          { ...actor, coachAccessStatus },
          path,
          "coach",
        ).map((x) => x.href),
        ["/", "/sessions/calendar", "/sessions", "/my-coaches"],
      );
    assert.deepEqual(
      mobileNavigationForActor(actor, path, "athlete").map((x) => x.href),
      ["/", "/sessions/calendar", "/sessions", "/my-coaches"],
    );
  }
});
