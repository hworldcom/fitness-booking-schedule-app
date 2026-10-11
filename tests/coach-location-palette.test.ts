import assert from "node:assert/strict";
import test from "node:test";
import { assignCoachLocationPaletteIndexes } from "@/features/coaches/coach-location-palette";
import { assignCoachProfileLocationColors } from "@/features/coaches/coach-profile-location-colors";

const COLLIDING_LOCATION_IDS = Object.freeze([
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000007",
]);

test("active coach locations resolve preferred palette collisions deterministically", () => {
  const first = assignCoachLocationPaletteIndexes(COLLIDING_LOCATION_IDS, 6);
  const second = assignCoachLocationPaletteIndexes(COLLIDING_LOCATION_IDS, 6);

  assert.notEqual(
    first.get(COLLIDING_LOCATION_IDS[0]),
    first.get(COLLIDING_LOCATION_IDS[1]),
  );
  assert.deepEqual(Array.from(first), Array.from(second));
});

test("location palette assignment stays bounded and ignores duplicate identities", () => {
  const locationIds = [
    ...COLLIDING_LOCATION_IDS,
    COLLIDING_LOCATION_IDS[0],
    "60000000-0000-4000-8000-000000000002",
    "60000000-0000-4000-8000-000000000003",
    "60000000-0000-4000-8000-000000000004",
    "60000000-0000-4000-8000-000000000005",
    "60000000-0000-4000-8000-000000000006",
  ];
  const assignments = assignCoachLocationPaletteIndexes(locationIds, 6);

  assert.equal(assignments.size, 7);
  assert.equal(new Set(Array.from(assignments.values()).slice(0, 6)).size, 6);
  assert.ok(
    Array.from(assignments.values()).every(
      (paletteIndex) => paletteIndex >= 0 && paletteIndex < 6,
    ),
  );
});

test("location palette assignment rejects an empty palette", () => {
  assert.throws(
    () => assignCoachLocationPaletteIndexes(COLLIDING_LOCATION_IDS, 0),
    /positive palette size/,
  );
});

test("public profile locations receive deterministic distinct colors without a fixed palette cap", () => {
  const locationIds = Object.freeze(
    Array.from(
      { length: 12 },
      (_, index) =>
        `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ),
  );
  const first = assignCoachProfileLocationColors(locationIds);
  const second = assignCoachProfileLocationColors(locationIds);
  const accents = locationIds.map(
    (locationId) => first.get(locationId)?.accent,
  );

  assert.equal(first.size, locationIds.length);
  assert.equal(new Set(accents).size, locationIds.length);
  assert.deepEqual([...first], [...second]);
  assert.equal(assignCoachProfileLocationColors([]).size, 0);
});
