import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeCoachDirectoryFilters,
  type CoachDirectoryState,
} from "@/domain/coaches";
import { HomeCoachDiscovery } from "@/features/coaches/home-coach-discovery";
import { CompactCoachCard } from "@/features/coaches/compact-coach-card";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
import { CoachStoryHome } from "@/features/public/coach-story";
import {
  HOME_COACH_PREVIEW_SIZE,
  HOME_DISCIPLINE_PATTERN,
  homeDiscipline,
  homeCoachDirectoryPreview,
  homeDirectoryHref,
  isCanonicalHomeSearch,
  normalizeHomeSearch,
} from "@/features/coaches/home-marketplace-contract";
import { directoryEntry } from "./fixtures/coach-directory";

const filters = normalizeCoachDirectoryFilters({});
const background = {
  src: "/_next/static/media/test-background.01234567.jpg",
  width: 1500,
  height: 1000,
};

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

test("Home preview stays bounded to four without mutating the full directory", () => {
  const rows = Object.freeze(
    Array.from({ length: 31 }, (_, index) =>
      directoryEntry(index + 1, "Coach " + String(index + 1).padStart(3, "0")),
    ),
  );
  for (const count of [0, 1, 3, 4, 5, 8, 31]) {
    const preview = homeCoachDirectoryPreview(rows.slice(0, count));
    assert.equal(preview.total, count);
    assert.equal(preview.entries.length, Math.min(count, 4));
    assert.deepEqual(
      preview.entries.map((row) => row.coach.profileId),
      rows.slice(0, Math.min(count, 4)).map((row) => row.coach.profileId),
    );
    assert.ok(Object.isFrozen(preview.entries));
  }
  assert.equal(HOME_COACH_PREVIEW_SIZE, 4);
  assert.equal(rows.length, 31);
});

test("Home URLs retain only discipline and reject retired query, location and pagination", () => {
  const search = normalizeHomeSearch({
    q: "ignored",
    discipline: " bjj ",
    location: " Mitte Berlin ",
    page: "2",
    view: "map",
  });
  assert.equal(
    homeDirectoryHref(search.filters),
    "/?discipline=Brazilian+Jiu-Jitsu",
  );
  assert.equal(search.filters.query, "");
  assert.equal(search.filters.location, "");
  assert.equal(
    isCanonicalHomeSearch(
      { discipline: "Brazilian Jiu-Jitsu" },
      search.filters,
    ),
    true,
  );
  for (const params of [
    { q: "footwork" },
    { location: "Mitte" },
    { page: "2" },
    { page: ["2", "3"] },
    { view: "map" },
    { discipline: "bjj" },
    { discipline: ["Boxing", "MMA"] },
  ]) {
    const { filters: normalized } = normalizeHomeSearch(params);
    assert.equal(isCanonicalHomeSearch(params, normalized), false);
    assert.doesNotMatch(
      homeDirectoryHref(normalized),
      /[?&](?:q|location|page|view)=/,
    );
  }
  assert.equal(homeDirectoryHref(normalizeHomeSearch({}).filters), "/");
  assert.equal(homeDiscipline("constructor"), null);
  assert.equal(homeDiscipline("__proto__"), null);
  assert.equal(homeDiscipline(" kickboxing "), "Kickboxing");
  const pattern = new RegExp("^(?:" + HOME_DISCIPLINE_PATTERN + ")$", "v");
  assert.equal(pattern.test(" bjj "), true);
  assert.equal(pattern.test("Muay   Thai"), true);
  assert.equal(pattern.test("Yoga"), false);
});

test("Home renders one four-coach preview and a discipline-preserving Explore destination", () => {
  const rows = Object.freeze(
    Array.from({ length: 31 }, (_, index) =>
      directoryEntry(index + 1, "Coach " + String(index + 1).padStart(3, "0"), {
        disciplines: ["Boxing", "Muay Thai", "Kickboxing"],
      }),
    ),
  );
  const selected = normalizeHomeSearch({
    discipline: "Boxing",
    q: "ignored",
    location: "Mitte",
  }).filters;
  for (const count of [0, 3, 31]) {
    const html = renderToStaticMarkup(
      createElement(HomeCoachDiscovery, {
        state: {
          status: "ready",
          filters: selected,
          entries: rows.slice(0, count),
        },
      }),
    );
    assert.equal(
      [...html.matchAll(/class="compact-coach-card marketplace/g)].length,
      Math.min(count, 4),
    );
    assert.equal(
      [...html.matchAll(/id="home-coach-grid"/g)].length,
      count ? 1 : 0,
    );
    assert.equal(
      [...html.matchAll(/<h3>Coach 001<\/h3>/g)].length,
      count ? 1 : 0,
    );
    assert.match(html, /href="\/explore\?discipline=Boxing"/);
    assert.match(html, />Explore more<\/a>/);
    assert.doesNotMatch(
      html,
      /Load more|Explore with a map|[?&](?:amp;)?(?:page|location|q|view)=/,
    );
  }
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

  assert.match(markup, /Showing 4 of 4 coaches/);
  assert.match(markup, /Amina Ali/);
  assert.match(markup, /Bao Bui/);
  assert.match(markup, /Carla Costa/);
  assert.match(markup, /Dario Diaz/);
  assert.doesNotMatch(markup, /Load more/);
  assert.match(markup, /src="\/images\/coaches\/amina-ali.webp"/);
  assert.match(markup, />BB<\/span>/);
  assert.match(markup, /Verified coach/);
  assert.match(markup, /Demo coach/);
  assert.doesNotMatch(markup, /Primary training place|Amina Ali training base/);
  assert.doesNotMatch(markup, /1 open time|No availability today/);
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
  assert.doesNotMatch(markup, /Bao Bui teaches focused private training/);
  assert.match(markup, /<h3>Bao Bui<\/h3>/);
  assert.match(markup, /Primary training location/);
  assert.match(markup, /No availability today/);
  assert.match(markup, /aria-label="Show Bao Bui on the map"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /href="\/coaches\/bao-bui"/);
});

test("Explore keeps explicit empty and unavailable directory states", () => {
  const empty = renderToStaticMarkup(
    createElement(CoachDirectory, {
      background,
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
      background,
      state: Object.freeze({ status: "unavailable" as const, filters }),
    }),
  );
  assert.match(unavailable, /Coach discovery is temporarily unavailable/);
  assert.match(unavailable, /Coach profiles could not be loaded/);
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
  assert.match(unavailable, /Coach discovery is temporarily unavailable/);
  assert.match(unavailable, /Coach profiles could not be loaded/);
  assert.doesNotMatch(unavailable, /compact-coach-card/);
});

test("home keeps discovery first and independent planning paths available in every directory state", () => {
  for (const directory of [
    { status: "ready", entries, filters },
    { status: "ready", entries: [], filters },
    { status: "unavailable", filters },
  ] as const) {
    const markup = renderToStaticMarkup(
      createElement(CoachStoryHome, {
        background,
        directory,
      }),
    );
    const searchIndex = markup.indexOf(
      'aria-label="Browse coaches by discipline"',
    );
    const previewIndex = markup.indexOf("Discover coaches in Berlin");
    const calendarIndex = markup.indexOf('id="home-training-calendar-title"');
    const invitationIndex = markup.indexOf('id="home-coach-cta-title"');
    assert.ok(searchIndex >= 0);
    assert.ok(previewIndex > searchIndex);
    assert.ok(calendarIndex > previewIndex);
    assert.ok(invitationIndex > calendarIndex);
    assert.match(markup, /Example training week/);
    assert.match(markup, /Your calendar and notes stay private/);
    assert.match(markup, /href="\/sessions\/routine"/);
    assert.match(markup, /href="\/sessions\/calendar"/);
    assert.match(markup, /href="\/how-it-works"/);
    assert.match(
      markup,
      /href="\/sign-in\?intent=coach&amp;returnTo=%2Fprofile%2Fcoach"/,
    );
    assert.doesNotMatch(markup, /coach-step-grid|marketplace-home-coach-cta/);
    assert.match(markup, /href="\/\?discipline=Boxing"/);
    assert.match(markup, /Explore more/);
    assert.doesNotMatch(markup, /<form|<input|Explore with a map|Load more/);
    assert.doesNotMatch(
      markup,
      /name="q"|Search coach or focus|by name, focus/,
    );
    assert.doesNotMatch(markup, /name="when"|near you|rating|price/i);
  }
});

test("Explore distinguishes today's actual venue from the primary training place", () => {
  const original = entries[0]!;
  const slot = original.todaySlots[0]!;
  const entry = {
    ...original,
    todaySlots: [
      {
        ...slot,
        location: {
          ...slot.location,
          name: "Another dojo",
          label: "24 Actual Venue Street, Berlin",
        },
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(CompactCoachCard, { entry, variant: "result" }),
  );
  assert.match(html, /Amina Ali training base/);
  assert.match(html, /Another dojo/);
  assert.match(html, /24 Actual Venue Street, Berlin/);
  assert.match(html, /1 open time/);
  assert.doesNotMatch(html, /Amina Ali teaches focused private training/);
});
