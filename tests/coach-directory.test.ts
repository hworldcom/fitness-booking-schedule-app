import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveCoachPrimaryLocation,
  type CoachDirectoryEntry,
  type CoachProjection,
  type CoachTrainingLocation,
} from "@/domain/coaches";
import { CoachTodayAvailability } from "@/features/coaches/coach-today-availability";
import type { LocationMapPoint } from "@/location";
import { layoutLocationMapMarkers } from "@/location";

function location(id: string, isPrimary: boolean): CoachTrainingLocation {
  return Object.freeze({
    id,
    publicName: isPrimary ? "Primary gym" : "Secondary gym",
    timezone: "Europe/Berlin",
    selectedGymId: null,
    gymName: null,
    location: Object.freeze({
      kind: "independent",
      label: isPrimary ? "Primary address" : "Secondary address",
      latitude: isPrimary ? 52.5 : 52.49,
      longitude: isPrimary ? 13.4 : 13.42,
      source: "manual",
      provider: null,
      confirmedAt: "2026-10-10T08:00:00.000Z",
    }),
    status: "active",
    isPrimary,
    sortOrder: isPrimary ? 1 : 2,
    deactivatedAt: null,
    recordSource: "user",
    updatedAt: "2026-10-10T08:00:00.000Z",
  });
}

function coach(
  primaryLocationId = "60000000-0000-4000-8000-000000000001",
): CoachProjection {
  const primary = location("60000000-0000-4000-8000-000000000001", true);
  return Object.freeze({
    profileId: "10000000-0000-4000-8000-000000000001",
    slug: "directory-coach",
    displayName: "Directory Coach",
    bio: "Private coaching with clear feedback and deliberate practice for developing athletes.",
    serviceMode: "private-training",
    timezone: "Europe/Berlin",
    primaryLocationId,
    locations: Object.freeze([
      primary,
      location("60000000-0000-4000-8000-000000000002", false),
    ]),
    selectedGymId: null,
    gymName: null,
    location: primary.location,
    visibility: "visible",
    recordSource: "user",
    trustKind: "verified",
    portraitUrl: null,
    disciplines: Object.freeze(["Boxing"] as const),
  });
}

function point(
  id: string,
  latitude: number,
  longitude: number,
): LocationMapPoint {
  return Object.freeze({
    id,
    name: id,
    label: `${id} address`,
    ariaLabel: `Select ${id}`,
    latitude,
    longitude,
    initials: id.slice(0, 2).toUpperCase(),
    imageUrl: null,
  });
}

test("directory markers resolve only the declared active primary location", () => {
  const projection = coach();
  assert.equal(
    resolveCoachPrimaryLocation(projection)?.id,
    projection.primaryLocationId,
  );
  assert.equal(
    resolveCoachPrimaryLocation(coach("60000000-0000-4000-8000-000000000099")),
    null,
  );
});

test("coincident marker layout is stable, distinct and preserves singleton anchors", () => {
  const sharedA = point("coach-a", 52.5, 13.4);
  const sharedB = point("coach-b", 52.5, 13.4);
  const single = point("coach-c", 52.6, 13.5);
  const layouts = layoutLocationMapMarkers([sharedB, single, sharedA]);
  const byId = new Map(layouts.map((layout) => [layout.pointId, layout]));

  assert.deepEqual(byId.get("coach-c")?.offset, [0, 0]);
  assert.equal(byId.get("coach-a")?.coincidentCount, 2);
  assert.equal(byId.get("coach-a")?.coincidentIndex, 1);
  assert.equal(byId.get("coach-b")?.coincidentIndex, 2);
  assert.notDeepEqual(byId.get("coach-a")?.offset, byId.get("coach-b")?.offset);

  const reversed = new Map(
    layoutLocationMapMarkers([sharedA, sharedB, single]).map((layout) => [
      layout.pointId,
      layout.offset,
    ]),
  );
  assert.deepEqual(reversed.get("coach-a"), byId.get("coach-a")?.offset);
  assert.deepEqual(reversed.get("coach-b"), byId.get("coach-b")?.offset);
});

test("marker layout rejects duplicate identities and invalid coordinates", () => {
  assert.throws(() =>
    layoutLocationMapMarkers([
      point("coach-a", 52.5, 13.4),
      point("coach-a", 52.6, 13.5),
    ]),
  );
  assert.throws(() =>
    layoutLocationMapMarkers([point("coach-a", Number.NaN, 13.4)]),
  );
});

test("today presentation names the occurrence venue separately from primary", () => {
  const projection = coach();
  const primaryLocation = resolveCoachPrimaryLocation(projection);
  assert.ok(primaryLocation);
  const entry: CoachDirectoryEntry = Object.freeze({
    coach: projection,
    primaryLocation,
    todaySlots: Object.freeze([
      Object.freeze({
        id: "70000000-0000-4000-8000-000000000001",
        startsAt: "2026-10-10T08:00:00.000Z",
        endsAt: "2026-10-10T09:00:00.000Z",
        coachTimezone: "UTC",
        location: Object.freeze({
          trainingLocationId: "60000000-0000-4000-8000-000000000002",
          name: "Secondary gym",
          kind: "independent" as const,
          selectedGymId: null,
          gymName: null,
          label: "Secondary address",
          latitude: 52.49,
          longitude: 13.42,
          source: "manual" as const,
          provider: null,
          confirmedAt: "2026-10-10T07:00:00.000Z",
        }),
      }),
    ]),
  });
  const markup = renderToStaticMarkup(
    createElement(CoachTodayAvailability, { entry, limit: 2 }),
  );
  assert.match(markup, /1 open time/);
  assert.match(markup, /10:00/);
  assert.match(markup, /Secondary gym/);
  assert.match(markup, /Secondary address/);
  assert.doesNotMatch(markup, /Primary gym/);

  const emptyMarkup = renderToStaticMarkup(
    createElement(CoachTodayAvailability, {
      entry: Object.freeze({ ...entry, todaySlots: Object.freeze([]) }),
      limit: 2,
    }),
  );
  assert.match(emptyMarkup, /No availability today/);
});
