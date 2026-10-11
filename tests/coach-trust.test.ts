import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachProjection } from "@/domain/coaches";
import { CoachProfileView } from "@/features/coaches/coach-discovery";

function coach(
  trustKind: CoachProjection["trustKind"],
  portraitUrl: string | null = null,
): CoachProjection {
  return Object.freeze({
    profileId: "10000000-0000-4000-8000-000000000001",
    slug: "reviewed-coach",
    displayName: "Reviewed Coach",
    bio: "Private boxing coaching with deliberate practice and clear feedback for every developing athlete.",
    serviceMode: "private-training",
    timezone: "Europe/Berlin",
    primaryLocationId: "60000000-0000-4000-8000-000000000001",
    locations: Object.freeze([
      Object.freeze({
        id: "60000000-0000-4000-8000-000000000001",
        publicName: "Tempelhofer Feld",
        timezone: "Europe/Berlin",
        selectedGymId: null,
        gymName: null,
        location: Object.freeze({
          kind: "independent" as const,
          label: "Tempelhofer Feld — main entrance",
          latitude: 52.473086,
          longitude: 13.403665,
          source: "manual" as const,
          provider: null,
          confirmedAt: "2026-10-08T09:00:00.000Z",
        }),
        status: "active" as const,
        isPrimary: true,
        sortOrder: 1,
        deactivatedAt: null,
        recordSource: (trustKind === "demo" ? "fixture" : "user") as
          "fixture" | "user",
        updatedAt: "2026-10-08T09:00:00.000Z",
      }),
    ]),
    selectedGymId: null,
    gymName: null,
    location: Object.freeze({
      kind: "independent",
      label: "Tempelhofer Feld — main entrance",
      latitude: 52.473086,
      longitude: 13.403665,
      source: "manual",
      provider: null,
      confirmedAt: "2026-10-08T09:00:00.000Z",
    }),
    visibility: "visible",
    recordSource: trustKind === "demo" ? "fixture" : "user",
    trustKind,
    portraitUrl,
    disciplines: Object.freeze(["Boxing"] as const),
  });
}

function renderCoach(trustKind: CoachProjection["trustKind"]) {
  return renderCoachProjection(coach(trustKind));
}

function renderCoachProjection(projection: CoachProjection) {
  return renderToStaticMarkup(
    createElement(CoachProfileView, {
      state: {
        status: "ready",
        coach: projection,
        slots: Object.freeze([]),
      },
      marketplace: createElement("div", null, "Schedule"),
    }),
  );
}

test("current platform approval renders the bounded verified claim", () => {
  const markup = renderCoach("verified");
  assert.match(markup, /Verified coach/);
  assert.match(
    markup,
    /MovX reviewed this coach&#x27;s identity and application/,
  );
  assert.match(markup, /does not guarantee licensing, competence, safety/);
  assert.doesNotMatch(markup, /Demo coach/);
});

test("fictional fixtures render a demo label instead of verification", () => {
  const markup = renderCoach("demo");
  assert.match(markup, /Demo coach/);
  assert.match(markup, /fictional profile is not a verified professional/);
  assert.doesNotMatch(markup, /Verified coach/);
});

test("a coach portrait renders when present and initials remain the fallback", () => {
  const withPortrait = renderToStaticMarkup(
    createElement(CoachProfileView, {
      state: {
        status: "ready",
        coach: coach("demo", "/images/coaches/daniel-park.webp"),
        slots: Object.freeze([]),
      },
      marketplace: createElement("div", null, "Schedule"),
    }),
  );
  assert.match(withPortrait, /src="\/images\/coaches\/daniel-park.webp"/);
  assert.match(withPortrait, /Daniel Park|Reviewed Coach/);

  const fallback = renderCoach("demo");
  assert.doesNotMatch(fallback, /<img/);
  assert.match(fallback, />RC<\/span>/);
});

test("public profiles list every active location, label the primary base and omit inactive history", () => {
  const primary = coach("verified");
  const primaryLocation = primary.locations[0];
  const secondary = Object.freeze({
    ...primaryLocation,
    id: "60000000-0000-4000-8000-000000000002",
    publicName: "Kreuzberg mat space",
    location: Object.freeze({
      ...primaryLocation.location,
      label: "Kreuzberg community hall — studio two",
    }),
    isPrimary: false,
    sortOrder: 2,
  });
  const inactive = Object.freeze({
    ...primaryLocation,
    id: "60000000-0000-4000-8000-000000000003",
    publicName: "Retired training room",
    location: Object.freeze({
      ...primaryLocation.location,
      label: "Old venue that must remain private",
    }),
    status: "inactive" as const,
    isPrimary: false,
    sortOrder: 3,
    deactivatedAt: "2026-10-10T09:00:00.000Z",
  });
  const html = renderCoachProjection(
    Object.freeze({
      ...primary,
      locations: Object.freeze([primaryLocation, secondary, inactive]),
    }),
  );

  assert.match(html, /Training locations/);
  assert.match(html, /Tempelhofer Feld/);
  assert.match(html, /Kreuzberg mat space/);
  assert.match(html, /Primary base/);
  assert.match(html, /not the coach&#x27;s current position/);
  assert.match(html, /Reviewed Coach training locations map/);
  assert.match(html, /Loading the location map/);
  assert.match(html, /Training location map legend/);
  assert.match(html, /aria-label="Show Tempelhofer Feld on the map"/);
  assert.match(html, /aria-label="Show Kreuzberg mat space on the map"/);
  assert.match(html, /aria-pressed="true"/);
  const locationColors = [
    ...html.matchAll(/data-location-color="([^"]+)"/g),
  ].map(([, color]) => color);
  assert.equal(locationColors.length, 2);
  assert.equal(new Set(locationColors).size, 2);
  assert.doesNotMatch(html, /Retired training room/);
  assert.doesNotMatch(html, /Old venue that must remain private/);
});
