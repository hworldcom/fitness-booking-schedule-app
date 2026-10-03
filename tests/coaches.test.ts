import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCoachSlotLocalStart,
  isCoachPublicSlug,
  localDateTimeValue,
  normalizeCoachDirectoryFilters,
  validateCoachAvailabilityInput,
  validateCoachProfileInput,
} from "@/domain/coaches";

test("coach directory filters accept only bounded supported values", () => {
  assert.deepEqual(
    normalizeCoachDirectoryFilters({
      q: "  calm   fundamentals ",
      discipline: "Muay Thai",
      location: "  Kreuzberg ",
      service: "private-training",
    }),
    {
      query: "calm fundamentals",
      discipline: "Muay Thai",
      location: "Kreuzberg",
      serviceMode: "private-training",
    },
  );
  assert.deepEqual(
    normalizeCoachDirectoryFilters({
      discipline: "Yoga",
      service: "group-class",
    }),
    {
      query: "",
      discipline: null,
      location: "",
      serviceMode: null,
    },
  );
});

test("coach profile validation separates gym and independent locations", () => {
  const gym = validateCoachProfileInput({
    displayName: "  Coach   Riley ",
    bio: " Private coaching with clear fundamentals, patient feedback and an adaptable pace. ",
    disciplines: ["Boxing", "Muay Thai"],
    timezone: "Europe/Berlin",
    visibility: "visible",
    selectedGymId: "40000000-0000-4000-8000-000000000001",
  });
  assert.equal(gym.valid, true);
  if (gym.valid) {
    assert.equal(gym.value.displayName, "Coach Riley");
    assert.equal(gym.value.independentLocation, null);
  }

  const independent = validateCoachProfileInput({
    displayName: "Coach Morgan",
    bio: "Private wrestling sessions centered on position, balance and repeatable technical progress.",
    disciplines: ["Wrestling"],
    timezone: "Europe/Berlin",
    visibility: "hidden",
    selectedGymId: "",
    locationLabel: "Tempelhofer Feld — main entrance",
    latitude: "52.473086",
    longitude: "13.403665",
    locationSource: "manual",
    locationProvider: "",
  });
  assert.equal(independent.valid, true);
  if (independent.valid) {
    assert.equal(independent.value.independentLocation?.latitude, 52.473086);
    assert.equal(independent.value.visibility, "hidden");
  }
});

test("coach profile validation rejects fabricated or malformed discovery data", () => {
  const result = validateCoachProfileInput({
    displayName: "X",
    bio: "Too short",
    disciplines: ["Boxing", "Yoga", "Boxing"],
    timezone: "Berlin",
    visibility: "published",
    selectedGymId: "",
    locationLabel: "",
    latitude: "91",
    longitude: "not-a-number",
    locationSource: "temporary-search-result",
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.length >= 7);
    assert.match(result.errors.join(" "), /supported disciplines/);
    assert.match(result.errors.join(" "), /Latitude/);
  }
});

test("public coach slugs are constrained", () => {
  assert.equal(isCoachPublicSlug("nora-klein"), true);
  assert.equal(isCoachPublicSlug("Nora Klein"), false);
  assert.equal(isCoachPublicSlug("../coach"), false);
});

test("coach availability accepts only explicit 15-minute bounded slots", () => {
  assert.deepEqual(
    validateCoachAvailabilityInput({
      localStart: "2026-10-05T14:15",
      durationMinutes: "60",
      refreshLocation: true,
    }),
    {
      valid: true,
      value: {
        localStart: "2026-10-05T14:15",
        durationMinutes: 60,
        refreshLocation: true,
      },
    },
  );

  for (const input of [
    { localStart: "2026-10-05T14:07", durationMinutes: 60 },
    { localStart: "2026-02-30T14:15", durationMinutes: 60 },
    { localStart: "2026-10-05T14:15", durationMinutes: 15 },
    { localStart: "2026-10-05T14:15", durationMinutes: 181 },
  ]) {
    assert.equal(validateCoachAvailabilityInput(input).valid, false);
  }
});

test("coach slot values are rendered in the reviewed profile timezone", () => {
  assert.equal(
    localDateTimeValue("2026-10-03T12:00:00.000Z", "Europe/Berlin"),
    "2026-10-03T14:00",
  );
  assert.equal(
    localDateTimeValue("2026-12-03T12:00:00.000Z", "Europe/Berlin"),
    "2026-12-03T13:00",
  );
  assert.equal(
    defaultCoachSlotLocalStart(
      "Europe/Berlin",
      new Date("2026-10-03T12:01:00.000Z"),
    ),
    "2026-10-03T14:45",
  );
});
