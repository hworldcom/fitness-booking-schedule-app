import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  homeCoachDirectoryPreview,
  MAX_HOME_COACH_PREVIEWS,
  normalizeCoachDirectoryFilters,
  type CoachDirectoryEntry,
  type CoachDirectoryState,
} from "@/domain/coaches";
import { HomeCoachDiscovery } from "@/features/coaches/home-coach-discovery";
import { CompactCoachCard } from "@/features/coaches/compact-coach-card";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
import { CoachStoryHome } from "@/features/public/coach-story";

const filters = normalizeCoachDirectoryFilters({});

function directoryEntry(
  sequence: number,
  displayName: string,
  options: Readonly<{
    portraitUrl?: string | null;
    trustKind?: "verified" | "demo";
    withAvailability?: boolean;
  }> = {},
): CoachDirectoryEntry {
  const suffix = String(sequence).padStart(12, "0");
  const profileId = `10000000-0000-4000-8000-${suffix}`;
  const locationId = `60000000-0000-4000-8000-${suffix}`;
  const location = Object.freeze({
    id: locationId,
    publicName: `${displayName} training base`,
    timezone: "Europe/Berlin",
    selectedGymId: null,
    gymName: null,
    location: Object.freeze({
      kind: "independent" as const,
      label: `${sequence} Teststrasse, Berlin`,
      latitude: 52.5 + sequence / 100,
      longitude: 13.4 + sequence / 100,
      source: "manual" as const,
      provider: null,
      confirmedAt: "2026-10-12T08:00:00.000Z",
    }),
    status: "active" as const,
    isPrimary: true,
    sortOrder: 1,
    deactivatedAt: null,
    recordSource: options.trustKind === "verified" ? "user" : "fixture",
    updatedAt: "2026-10-12T08:00:00.000Z",
  });
  return Object.freeze({
    coach: Object.freeze({
      profileId,
      slug: displayName.toLowerCase().replaceAll(" ", "-"),
      displayName,
      bio: `${displayName} teaches focused private training.`,
      serviceMode: "private-training" as const,
      timezone: "Europe/Berlin",
      primaryLocationId: locationId,
      locations: Object.freeze([location]),
      selectedGymId: null,
      gymName: null,
      location: location.location,
      visibility: "visible" as const,
      recordSource:
        options.trustKind === "verified"
          ? ("user" as const)
          : ("fixture" as const),
      trustKind: options.trustKind ?? "demo",
      portraitUrl: options.portraitUrl ?? null,
      disciplines: Object.freeze(["Boxing"] as const),
    }),
    primaryLocation: location,
    todaySlots: options.withAvailability
      ? Object.freeze([
          Object.freeze({
            id: `70000000-0000-4000-8000-${suffix}`,
            startsAt: "2026-10-12T08:00:00.000Z",
            endsAt: "2026-10-12T09:00:00.000Z",
            coachTimezone: "Europe/Berlin",
            requestEligibility: "requestable" as const,
            location: Object.freeze({
              trainingLocationId: locationId,
              name: location.publicName,
              kind: "independent" as const,
              selectedGymId: null,
              gymName: null,
              label: location.location.label,
              latitude: location.location.latitude,
              longitude: location.location.longitude,
              source: "manual" as const,
              provider: null,
              confirmedAt: location.location.confirmedAt,
            }),
          }),
        ])
      : Object.freeze([]),
  });
}

const entries = Object.freeze([
  directoryEntry(1, "Amina Ali", {
    portraitUrl: "/images/coaches/amina-ali.webp",
    trustKind: "verified",
    withAvailability: true,
  }),
  directoryEntry(2, "Bao Bui"),
  directoryEntry(3, "Carla Costa"),
  directoryEntry(4, "Dario Diaz"),
]);

test("home preview remains bounded and preserves directory ordering", () => {
  const preview = homeCoachDirectoryPreview(entries);
  assert.equal(preview.length, MAX_HOME_COACH_PREVIEWS);
  assert.deepEqual(
    preview.map((entry) => entry.coach.displayName),
    ["Amina Ali", "Bao Bui", "Carla Costa"],
  );
  assert.equal(entries.length, 4);
  assert.ok(Object.isFrozen(preview));
});

test("ready home discovery renders authoritative profiles and fallbacks only", () => {
  const state: CoachDirectoryState = Object.freeze({
    status: "ready",
    entries,
    filters,
  });
  const markup = renderToStaticMarkup(
    createElement(HomeCoachDiscovery, { state }),
  );

  assert.match(markup, /Showing 3 of 4 coaches · ordered by coach name/);
  assert.match(markup, /Amina Ali/);
  assert.match(markup, /Bao Bui/);
  assert.match(markup, /Carla Costa/);
  assert.doesNotMatch(markup, /Dario Diaz/);
  assert.match(markup, /src="\/images\/coaches\/amina-ali.webp"/);
  assert.match(markup, />BB<\/span>/);
  assert.match(markup, /Verified coach/);
  assert.match(markup, /Demo coach/);
  assert.match(markup, /Amina Ali training base/);
  assert.match(markup, /1 open time/);
  assert.match(markup, /No availability today/);
  assert.match(markup, /href="\/coaches\/amina-ali"/);
  assert.doesNotMatch(markup, /near you|recommended|rating|price/i);
});

test("compact result card exposes truthful comparison and selection boundaries", () => {
  const entry = entries[1]!;
  const markup = renderToStaticMarkup(
    createElement(CompactCoachCard, {
      entry,
      variant: "result",
      selected: true,
      onShowOnMap: () => undefined,
    }),
  );

  assert.match(markup, /compact-coach-card result selected/);
  assert.match(markup, /data-selected="true"/);
  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, />BB<\/span>/);
  assert.match(markup, /Bao Bui teaches focused private training/);
  assert.match(markup, /Primary training location/);
  assert.match(markup, /No availability today/);
  assert.match(markup, /aria-label="Show Bao Bui on the map"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /href="\/coaches\/bao-bui"/);
});

test("Explore keeps explicit empty and unavailable directory states", () => {
  const empty = renderToStaticMarkup(
    createElement(CoachDirectory, {
      state: Object.freeze({
        status: "ready" as const,
        entries: Object.freeze([]),
        filters,
      }),
    }),
  );
  assert.match(empty, /No coaches match these filters/);
  assert.match(empty, /Clear filters/);
  assert.doesNotMatch(empty, /coach-map-panel|compact-coach-card result/);

  const unavailable = renderToStaticMarkup(
    createElement(CoachDirectory, {
      state: Object.freeze({ status: "unavailable" as const, filters }),
    }),
  );
  assert.match(unavailable, /Coach discovery is temporarily unavailable/);
  assert.match(unavailable, /No fixture fallback or invented availability/);
  assert.doesNotMatch(unavailable, /coach-map-panel|compact-coach-card result/);
});

test("home discovery keeps empty and unavailable data states honest", () => {
  const empty = renderToStaticMarkup(
    createElement(HomeCoachDiscovery, {
      state: Object.freeze({
        status: "ready",
        entries: Object.freeze([]),
        filters,
      }),
    }),
  );
  assert.match(empty, /No public coaches yet/);
  assert.doesNotMatch(empty, /compact-coach-card/);

  const unavailable = renderToStaticMarkup(
    createElement(HomeCoachDiscovery, {
      state: Object.freeze({ status: "unavailable", filters }),
    }),
  );
  assert.match(unavailable, /Coach previews are temporarily unavailable/);
  assert.match(unavailable, /No fallback profiles or opening times/);
  assert.doesNotMatch(unavailable, /compact-coach-card/);
});

test("home orders working discovery before the concise confirmation flow", () => {
  const markup = renderToStaticMarkup(
    createElement(CoachStoryHome, {
      directory: Object.freeze({ status: "ready", entries, filters }),
    }),
  );
  const searchIndex = markup.indexOf('aria-label="Search coaches"');
  const previewIndex = markup.indexOf("A first look at the directory.");
  const explanationIndex = markup.indexOf(
    "Three steps from search to a clear answer.",
  );
  assert.ok(searchIndex >= 0);
  assert.ok(previewIndex > searchIndex);
  assert.ok(explanationIndex > previewIndex);
  assert.match(markup, /request stays pending until the coach accepts it/i);
  assert.match(markup, /not an instant booking/i);
  assert.match(markup, /Discipline or training place/);
  assert.match(markup, /name="discipline"/);
  assert.match(markup, /name="location"/);
  assert.doesNotMatch(markup, /name="q"|Search coach or focus|by name, focus/);
  assert.doesNotMatch(markup, /name="when"|near you|rating|price/i);
});
