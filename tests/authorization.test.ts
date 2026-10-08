import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_ACTOR,
  isActorSnapshot,
  type ActorSnapshot,
} from "@/auth/actor-contracts";
import { actorSessionKey, visibleActorForSession } from "@/auth/actor-state";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { safeReturnTo, signInHref } from "@/auth/return-to";
import { parseApplicationAccessMode } from "@/server/authorization/config";

const databaseEnvironment = {
  databaseUrl:
    "postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres",
  supabaseUrl: "http://127.0.0.1:55321",
  supabasePublishableKey: "public-key",
  siteUrl: "http://localhost:3100",
} as const;

test("access mode distinguishes absent, complete and partial configuration", () => {
  assert.equal(parseApplicationAccessMode({}), "preview");
  assert.equal(parseApplicationAccessMode(databaseEnvironment), "database");
  assert.equal(
    parseApplicationAccessMode({
      ...databaseEnvironment,
      databaseUrl: undefined,
    }),
    "unavailable",
  );
  assert.equal(
    parseApplicationAccessMode({
      ...databaseEnvironment,
      supabasePublishableKey: "",
    }),
    "unavailable",
  );
});

test("actor responses accept only the bounded public shape", () => {
  assert.equal(isActorSnapshot({ status: "preview" }), true);
  assert.equal(isActorSnapshot({ status: "signed-out" }), true);
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "anna-klein",
        displayName: "Anna Klein",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
      coachAccessStatus: "not-applied",
    }),
    true,
  );
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "daniel-park",
        displayName: "Daniel Park",
        avatarUrl: null,
        coachPortraitUrl: "/images/coaches/daniel-park.webp",
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
      coachAccessStatus: "demo",
    }),
    true,
  );
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "daniel-park",
        displayName: "Daniel Park",
        avatarUrl: null,
        coachPortraitUrl: "/images/coaches/../private.webp",
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
      coachAccessStatus: "demo",
    }),
    false,
  );
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "anna-klein",
        displayName: "Anna Klein",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
    }),
    false,
  );
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "anna-klein",
        displayName: "Anna Klein",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
      coachAccessStatus: "invented",
    }),
    false,
  );
  assert.equal(
    isActorSnapshot({
      status: "authorized",
      profile: {
        slug: "anna-klein",
        displayName: "Anna Klein",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: {
        slug: "local-foundation-2030",
        name: "Local foundation run",
      },
      role: "member",
      coachAccessStatus: "not-applied",
      email: "private@example.com",
    }),
    false,
  );
  assert.equal(isActorSnapshot({ status: "authorized" }), false);
});

test("return destinations preserve safe internal state and reject redirects", () => {
  const origin = "http://localhost:3100";
  assert.equal(
    safeReturnTo("/packages?view=active#current", origin),
    "/packages?view=active#current",
  );
  assert.equal(safeReturnTo("https://example.com/steal", origin), "/");
  assert.equal(safeReturnTo("//example.com/steal", origin), "/");
  assert.equal(safeReturnTo("/\\example.com", origin), "/");
  assert.equal(safeReturnTo("/%5cexample.com", origin), "/");
  assert.equal(safeReturnTo("/%2fexample.com", origin), "/");
  assert.equal(safeReturnTo("/api/auth/actor", origin), "/");
  assert.equal(safeReturnTo("/sign-in?returnTo=/profile", origin), "/");
  assert.equal(safeReturnTo("/%E0%A4%A", origin), "/");
  assert.equal(safeReturnTo(["/profile"], origin), "/");
  assert.equal(signInHref("/profile"), "/sign-in?returnTo=%2Fprofile");
  assert.equal(
    signInHref("/clubs/sign-in"),
    "/sign-in?returnTo=%2Fclubs%2Fsign-in",
  );
});

test("private actor state is bound to the exact verified session generation", () => {
  const session: AuthSessionSnapshot = {
    status: "signed-in",
    subject: "93000000-0000-4000-8000-000000000001",
    email: "anna@example.com",
    expiresAt: 1_790_000_000,
  };
  const actor: ActorSnapshot = {
    status: "authorized",
    profile: {
      slug: "anna-klein",
      displayName: "Anna Klein",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: {
      slug: "local-foundation-2030",
      name: "Local foundation run",
    },
    role: "member",
    coachAccessStatus: "not-applied",
  };
  const actorState = { sessionKey: actorSessionKey(session), actor };

  assert.deepEqual(visibleActorForSession(session, actorState), actor);
  assert.deepEqual(
    visibleActorForSession(
      { ...session, subject: "93000000-0000-4000-8000-000000000002" },
      actorState,
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    visibleActorForSession(
      { ...session, expiresAt: 1_790_000_001 },
      actorState,
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    visibleActorForSession({ status: "signed-out" }, actorState),
    { status: "signed-out" },
  );
  assert.deepEqual(
    visibleActorForSession(
      { status: "disabled" },
      { sessionKey: "disabled", actor: PREVIEW_ACTOR },
    ),
    PREVIEW_ACTOR,
  );
});
