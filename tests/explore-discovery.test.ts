import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { directoryEntry } from "./fixtures/coach-directory";
import {
  BERLIN_SEARCH_ORIGIN,
  EMPTY_EXPLORE_PREFERENCES,
  distanceInKm,
  explorePreferenceScope,
  exploreStorageKey,
  isExplorePlace,
  parseExplorePreferences,
  pointInExploreBounds,
  selectExploreEntries,
} from "@/features/coaches/explore-discovery-model";

test("nearby ordering uses published primary points, applies saved/area filters and stays deterministic", () => {
  const far = directoryEntry(1, "A first alphabetically"),
    close = directoryEntry(2, "Z closer");
  const origin = close.primaryLocation.location;
  assert.equal(
    selectExploreEntries([far, close], origin, null, [], false)[0].entry.coach
      .profileId,
    close.coach.profileId,
  );
  const saved = [far.coach.profileId];
  assert.deepEqual(
    selectExploreEntries([close, far], origin, null, saved, true).map(
      (row) => row.entry.coach.profileId,
    ),
    saved,
  );
  const bounds = {
    west: origin.longitude - 0.00001,
    east: origin.longitude + 0.00001,
    south: origin.latitude - 0.00001,
    north: origin.latitude + 0.00001,
  };
  assert.deepEqual(
    selectExploreEntries([far, close], origin, bounds, [], false).map(
      (row) => row.entry.coach.profileId,
    ),
    [close.coach.profileId],
  );
  assert.equal(
    selectExploreEntries([close], origin, bounds, saved, true).length,
    0,
  );
  assert.equal(
    selectExploreEntries([close], origin, null, ["not-a-public-entry"], true)
      .length,
    0,
  );
  assert.deepEqual(
    [far, close].map((row) => row.coach.displayName),
    ["A first alphabetically", "Z closer"],
  );
});
test("distance handles zero, poles and the antimeridian without invalid arithmetic", () => {
  assert.equal(distanceInKm(BERLIN_SEARCH_ORIGIN, BERLIN_SEARCH_ORIGIN), 0);
  assert.ok(
    Math.abs(
      distanceInKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0.1, longitude: 0 },
      ) - 11.1195,
    ) < 0.01,
  );
  assert.ok(
    distanceInKm(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    ) < 23,
  );
  assert.ok(
    Number.isFinite(
      distanceInKm(
        { latitude: 90, longitude: 180 },
        { latitude: -90, longitude: -180 },
      ),
    ),
  );
  const crossing = { west: 170, east: -170, south: -10, north: 10 };
  assert.equal(
    pointInExploreBounds({ latitude: 0, longitude: -179 }, crossing),
    true,
  );
  assert.equal(
    pointInExploreBounds({ latitude: 0, longitude: 0 }, crossing),
    false,
  );
  assert.equal(
    pointInExploreBounds({ latitude: 11, longitude: 179 }, crossing),
    false,
  );
});
test("browser preferences round-trip only bounded valid places and public coach identifiers", () => {
  const id = directoryEntry(1, "Coach").coach.profileId;
  const preferences = {
    ...EMPTY_EXPLORE_PREFERENCES,
    view: "map",
    favorites: [id, id],
    places: { home: { ...BERLIN_SEARCH_ORIGIN, label: "Home" }, work: null },
  };
  assert.deepEqual(
    parseExplorePreferences(JSON.stringify(preferences))?.favorites,
    [id],
  );
  assert.equal(
    parseExplorePreferences(JSON.stringify(preferences))?.places.home?.label,
    "Home",
  );
  assert.equal(parseExplorePreferences("bad JSON"), null);
  assert.equal(parseExplorePreferences("x".repeat(48_001)), null);
  for (const invalid of [
    { ...preferences, version: 0 },
    { ...preferences, view: "any" },
    { ...preferences, favorites: ["foreign arbitrary string"] },
    { ...preferences, favorites: Array(301).fill(id) },
    {
      ...preferences,
      places: {
        home: { label: "Home", latitude: 91, longitude: 0 },
        work: null,
      },
    },
    { ...preferences, places: {} },
  ])
    assert.equal(parseExplorePreferences(JSON.stringify(invalid)), null);
  assert.equal(
    isExplorePlace({ latitude: 0, longitude: 0, label: " " }),
    false,
  );
});
test("preference identity separates accounts/datasets/guests and conceals data while authority is unknown", () => {
  const session: AuthSessionSnapshot = {
    status: "signed-in",
    subject: "subject-a",
    email: "private@example.test",
    expiresAt: null,
  };
  const actor = {
    status: "authorized",
    demoRun: { slug: "dataset-a", name: "A" },
  } as ActorSnapshot;
  const own = explorePreferenceScope(session, actor);
  assert.equal(own, "dataset-a:subject-a");
  assert.notEqual(
    own,
    explorePreferenceScope({ ...session, subject: "subject-b" }, actor),
  );
  assert.notEqual(
    own,
    explorePreferenceScope(session, {
      ...actor,
      demoRun: { slug: "dataset-b", name: "B" },
    } as ActorSnapshot),
  );
  for (const status of ["unavailable", "signed-out", "forbidden"] as const)
    assert.equal(explorePreferenceScope(session, { status }), null);
  assert.equal(
    explorePreferenceScope({ status: "signed-out" }, { status: "signed-out" }),
    "guest",
  );
  assert.equal(
    explorePreferenceScope({ status: "disabled" }, { status: "preview" }),
    "preview",
  );
  assert.equal(explorePreferenceScope({ status: "unavailable" }, actor), null);
  assert.doesNotMatch(exploreStorageKey(own!), /private@example/);
});
