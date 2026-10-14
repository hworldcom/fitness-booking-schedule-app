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
  HOME_COACH_PAGE_SIZE,
  HOME_DISCIPLINE_PATTERN,
  homeDiscipline,
  homeCoachDirectoryPage,
  homeDirectoryHref,
  isCanonicalHomeSearch,
  normalizeHomeSearch,
} from "@/features/coaches/home-marketplace-contract";
import { directoryEntry } from "./fixtures/coach-directory";

const filters = normalizeCoachDirectoryFilters({});

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

test("Home pagination expands in 15-coach increments and clamps to available rows", () => {
  const rows = Object.freeze(
    Array.from({ length: 31 }, (_, index) =>
      directoryEntry(index + 1, "Coach " + String(index + 1).padStart(3, "0")),
    ),
  );
  for (const count of [0, 1, 14, 15, 16, 30, 31]) {
    for (const page of [1, 2, 3, Number.MAX_SAFE_INTEGER, 0, NaN]) {
      const slice = homeCoachDirectoryPage(rows.slice(0, count), page);
      const expectedPage = Math.min(
        Number.isSafeInteger(page) && page > 0 ? page : 1,
        Math.max(1, Math.ceil(count / HOME_COACH_PAGE_SIZE)),
      );
      assert.equal(slice.page, expectedPage);
      assert.equal(
        slice.entries.length,
        Math.min(count, expectedPage * HOME_COACH_PAGE_SIZE),
      );
      assert.equal(slice.hasMore, slice.entries.length < count);
      assert.deepEqual(
        slice.entries.map((row) => row.coach.profileId),
        rows.slice(0, slice.entries.length).map((row) => row.coach.profileId),
      );
      assert.ok(Object.isFrozen(slice.entries));
    }
  }
  assert.equal(rows.length, 31);
});

test("Home URLs normalize only discipline, location and safe pagination", () => {
  const search = normalizeHomeSearch({
    q: "ignored",
    discipline: " bjj ",
    location: " Mitte   Berlin ",
    page: "2",
    view: "map",
  });
  assert.equal(
    homeDirectoryHref(search.filters, search.page),
    "/?discipline=Brazilian+Jiu-Jitsu&location=Mitte+Berlin&page=2",
  );
  assert.equal(search.filters.query, "");
  assert.equal(
    isCanonicalHomeSearch(
      {
        discipline: "Brazilian Jiu-Jitsu",
        location: "Mitte Berlin",
        page: "2",
      },
      search.filters,
      search.page,
    ),
    true,
  );
  assert.equal(
    isCanonicalHomeSearch(
      { q: "", page: "1" },
      normalizeHomeSearch({}).filters,
      1,
    ),
    false,
  );
  for (const page of [
    "0",
    "-1",
    "1.5",
    "Infinity",
    "9007199254740992",
    ["2", "3"],
  ]) {
    assert.equal(normalizeHomeSearch({ page }).page, 1);
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

test("Home renders one paginated grid and one card for a multi-discipline coach", () => {
  const rows = Object.freeze(
    Array.from({ length: 31 }, (_, index) =>
      directoryEntry(index + 1, "Coach " + String(index + 1).padStart(3, "0"), {
        disciplines: ["Boxing", "Muay Thai", "Kickboxing"],
      }),
    ),
  );
  for (const page of [1, 2, 3]) {
    const html = renderToStaticMarkup(
      createElement(HomeCoachDiscovery, {
        state: { status: "ready", filters, entries: rows },
        page,
      }),
    );
    assert.equal(
      [...html.matchAll(/class="compact-coach-card marketplace/g)].length,
      Math.min(31, page * 15),
    );
    assert.equal([...html.matchAll(/id="home-coach-grid"/g)].length, 1);
    assert.equal([...html.matchAll(/<h3>Coach 001<\/h3>/g)].length, 1);
    if (page < 3)
      assert.match(html, new RegExp('href="/\\?page=' + (page + 1) + '"'));
    else assert.doesNotMatch(html, /Load more/);
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
  assert.match(markup, /Amina Ali training base/);
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
  assert.match(unavailable, /Coach discovery is temporarily unavailable/);
  assert.match(unavailable, /Coach profiles could not be loaded/);
  assert.doesNotMatch(unavailable, /compact-coach-card/);
});

test("home orders working discovery before the concise confirmation flow", () => {
  const markup = renderToStaticMarkup(
    createElement(CoachStoryHome, {
      directory: Object.freeze({ status: "ready", entries, filters }),
    }),
  );
  const searchIndex = markup.indexOf('aria-label="Search coaches"');
  const previewIndex = markup.indexOf("Discover coaches in Berlin");
  const explanationIndex = markup.indexOf(
    "Three steps from search to a clear answer.",
  );
  assert.ok(searchIndex >= 0);
  assert.ok(previewIndex > searchIndex);
  assert.ok(explanationIndex > previewIndex);
  assert.match(markup, /request stays pending until the coach accepts it/i);
  assert.match(markup, /not an instant booking/i);
  assert.match(markup, /All disciplines/);
  assert.match(markup, /action="\/"/);
  assert.match(markup, /list="home-discipline-suggestions"/);
  assert.match(markup, /name="discipline"/);
  assert.match(markup, /name="location"/);
  assert.doesNotMatch(markup, /name="q"|Search coach or focus|by name, focus/);
  assert.doesNotMatch(markup, /name="when"|near you|rating|price/i);
});
