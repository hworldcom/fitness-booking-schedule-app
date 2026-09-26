import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  CLUB_EMAIL_SIGN_IN_HREF,
  visibleClubEntryState,
} from "@/features/clubs/club-entry-state";
import type { ClubWalletSnapshot } from "@/solana/club-wallet";

const actor = {
  status: "authorized",
  profile: { slug: "riley-morgan", displayName: "Riley Morgan" },
  demoRun: { slug: "berlin-demo", name: "Berlin Demo" },
  role: "member",
} as const satisfies ActorSnapshot;

const club = {
  slug: "northside-combat",
  name: "Northside Combat",
  wallet: {
    address: "GgBaCs3N8PpqJm1nT6CywU4wzEq7h4HfZ8C9K6E7Y8xQ",
    cluster: "solana:devnet",
    verifiedAt: "2026-09-22T10:00:00.000Z",
  },
} as const;

test("club entry uses the fixed canonical personal sign-in return", () => {
  assert.equal(CLUB_EMAIL_SIGN_IN_HREF, "/sign-in?returnTo=%2Fclubs%2Fsign-in");
});

test("club entry hides stale club context unless the actor is authorized", () => {
  const eligible = { status: "eligible", club } as const;
  for (const status of [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    assert.deepEqual(visibleClubEntryState({ status }, eligible), { status });
  }
  assert.deepEqual(visibleClubEntryState(actor, null), { status: "loading" });
});

test("an authorized actor sees only the bounded server club snapshot", () => {
  const snapshots: ClubWalletSnapshot[] = [
    { status: "preview" },
    { status: "signed-out" },
    { status: "forbidden" },
    { status: "unavailable" },
    { status: "no-club-access" },
    { status: "eligible", club },
    {
      status: "authorized",
      club,
      authority: {
        grantedAt: "2026-09-22T10:01:00.000Z",
        expiresAt: "2026-09-22T10:11:00.000Z",
      },
    },
  ];

  for (const snapshot of snapshots) {
    assert.equal(visibleClubEntryState(actor, snapshot), snapshot);
  }
});
