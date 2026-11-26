import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COACH_DISCIPLINES,
  normalizeCoachDirectoryFilters,
} from "@/domain/coaches";
import {
  canonicalCoachExploreView,
  coachDirectoryHref,
  isCanonicalCoachDirectorySearch,
  normalizeCoachExploreView,
  normalizeCoachExploreFilters,
} from "@/features/coaches/marketplace-search-contract";
import { PublicMarketplaceSearch } from "@/features/coaches/public-marketplace-search";

const FILTERS = normalizeCoachDirectoryFilters({
  q: "  patient   footwork ",
  discipline: "Muay Thai",
  location: " Kreuzberg ",
  service: "private-training",
});

test("marketplace search URLs contain only normalized supported filters", () => {
  assert.equal(
    coachDirectoryHref(FILTERS),
    "/explore?q=patient+footwork&discipline=Muay+Thai&location=Kreuzberg",
  );
  assert.equal(
    coachDirectoryHref(FILTERS, { discipline: null }),
    "/explore?q=patient+footwork&location=Kreuzberg",
  );
  assert.equal(
    coachDirectoryHref(FILTERS, {
      query: " ",
      discipline: "Boxing",
      location: " Mitte   Berlin ",
    }),
    "/explore?discipline=Boxing&location=Mitte+Berlin",
  );
  assert.equal(
    coachDirectoryHref(normalizeCoachDirectoryFilters({})),
    "/explore",
  );
  assert.equal(
    coachDirectoryHref(FILTERS, {}, "map"),
    "/explore?q=patient+footwork&discipline=Muay+Thai&location=Kreuzberg&view=map",
  );
  assert.equal(
    coachDirectoryHref(FILTERS, { discipline: null }, "list"),
    "/explore?q=patient+footwork&location=Kreuzberg&view=list",
  );
});

test("mobile Explore view state is bounded and defaults safely to list", () => {
  assert.equal(normalizeCoachExploreView({}), "list");
  assert.equal(normalizeCoachExploreView({ view: "list" }), "list");
  assert.equal(normalizeCoachExploreView({ view: "map" }), "map");
  assert.equal(normalizeCoachExploreView({ view: "grid" }), "list");
  assert.equal(normalizeCoachExploreView({ view: ["map", "list"] }), "list");
  assert.equal(canonicalCoachExploreView({}), null);
  assert.equal(canonicalCoachExploreView({ view: "map" }), "map");
  assert.equal(canonicalCoachExploreView({ view: "grid" }), null);
});

test("canonical search rejects blank, repeated scalar, legacy and unknown parameters", () => {
  assert.equal(
    isCanonicalCoachDirectorySearch(
      {
        q: "patient footwork",
        discipline: "Muay Thai",
        location: "Kreuzberg",
      },
      FILTERS,
    ),
    true,
  );
  for (const searchParams of [
    { q: ["patient footwork", "boxing"] },
    { q: "" },
    { discipline: "Yoga" },
    { service: "private-training" },
    { when: "tomorrow" },
    { view: "grid" },
    { view: ["map", "list"] },
  ]) {
    assert.equal(
      isCanonicalCoachDirectorySearch(
        searchParams,
        normalizeCoachDirectoryFilters(searchParams),
      ),
      false,
    );
  }

  assert.equal(
    isCanonicalCoachDirectorySearch(
      {
        q: "patient footwork",
        discipline: "Muay Thai",
        location: "Kreuzberg",
        view: "map",
      },
      FILTERS,
      "map",
    ),
    true,
  );

  const overlongQuery = "x".repeat(100);
  const boundedFilters = normalizeCoachDirectoryFilters({ q: overlongQuery });
  assert.equal(boundedFilters.query.length, 80);
  assert.equal(
    isCanonicalCoachDirectorySearch({ q: overlongQuery }, boundedFilters),
    false,
  );
});

test("Explore search renders one GET contract and selected native category checkboxes", () => {
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, { filters: FILTERS }),
  );
  assert.match(html, /action="\/explore"/);
  assert.doesNotMatch(html, /method="post"/);
  assert.match(html, /aria-label="Search coaches"/);
  assert.match(html, /name="q"/);
  assert.match(html, /<form[^>]*id="explore-search-form"/);
  assert.match(
    html,
    /<form[^>]*>[\s\S]*<input[^>]*id="explore-query"[^>]*name="q"[\s\S]*<\/form>/,
  );
  assert.equal([...html.matchAll(/name="q"/g)].length, 1);
  assert.ok(
    [...html.matchAll(/<input[^>]*>/g)].some(
      ([input]) =>
        input.includes('value="Muay Thai"') && input.includes('checked=""'),
    ),
  );
  assert.doesNotMatch(
    html,
    /id="explore-discipline"|<datalist|explore-query-refinement/,
  );
  assert.match(html, /name="discipline"/);
  assert.match(html, /name="location"/);
  for (const discipline of COACH_DISCIPLINES)
    assert.ok(html.includes(`value="${discipline}"`));
  assert.match(html, /name="session"/);
  assert.doesNotMatch(html, /home-discipline-shortcut/);
  assert.doesNotMatch(html, /name="service"/);
  assert.doesNotMatch(html, /name="when"|price|rating|distance/i);
});

test("Explore has one coach/focus search and all categories when no checkbox is selected", () => {
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, {
      filters: normalizeCoachDirectoryFilters({
        q: "footwork",
        location: "Berlin",
      }),
    }),
  );
  assert.equal([...html.matchAll(/name="q"/g)].length, 1);
  assert.match(html, /name="q"[^>]*value="footwork"/);
  assert.match(html, /name="location"[^>]*value="Berlin"/);
  assert.match(html, /Search coach or focus/);
  assert.doesNotMatch(html, /type="hidden" name="discipline"|<datalist/);
  assert.equal(
    [...html.matchAll(/<input[^>]*type="checkbox"[^>]*checked=""/g)].length,
    0,
  );
  assert.match(html, /href="\/explore"/);
});

test("Explore typed disciplines use Home's aliases without accepting unsupported values", () => {
  for (const [value, expected] of [
    [" boxing ", "Boxing"],
    ["Muay   Thai", "Muay Thai"],
    ["BJJ", "Brazilian Jiu-Jitsu"],
    ["thai boxing", "Muay Thai"],
    [" wellness ", "Wellness"],
    ["All disciplines", null],
    ["Yoga", null],
    ["constructor", null],
  ] as const) {
    const filters = normalizeCoachExploreFilters({
      discipline: value,
      q: " patient   footwork ",
      location: " Berlin ",
      view: "map",
    });
    assert.equal(filters.discipline, expected);
    assert.equal(filters.query, "patient footwork");
    assert.equal(filters.location, "Berlin");
    assert.equal(
      isCanonicalCoachDirectorySearch(
        {
          discipline: value,
          q: " patient   footwork ",
          location: " Berlin ",
          view: "map",
        },
        filters,
        "map",
      ),
      false,
    );
  }
});

test("Explore's search and clear retain the explicit view and applied category", () => {
  for (const view of ["list", "map"] as const) {
    const html = renderToStaticMarkup(
      createElement(PublicMarketplaceSearch, { filters: FILTERS, view }),
    );
    assert.match(html, new RegExp('name="view"[^>]*value="' + view + '"'));
    assert.ok(html.includes('href="/explore?view=' + view + '"'));
    assert.ok(
      [...html.matchAll(/<input[^>]*>/g)].some(
        ([input]) =>
          input.includes('value="Muay Thai"') && input.includes('checked=""'),
      ),
    );
    assert.doesNotMatch(html, /id="home-discipline"|name="page"/);
  }
});

test("session and saved filters are canonical, bounded and preserved by view URLs", () => {
  const filters = normalizeCoachExploreFilters({
    q: "coach",
    session: "group",
    saved: "1",
  });
  assert.equal(
    coachDirectoryHref(filters, {}, "map"),
    "/explore?q=coach&session=group&saved=1&view=map",
  );
  assert.equal(
    coachDirectoryHref(
      filters,
      { sessionFormat: null, savedOnly: false },
      "list",
    ),
    "/explore?q=coach&view=list",
  );
  assert.equal(
    isCanonicalCoachDirectorySearch(
      { q: "coach", session: "group", saved: "1", view: "map" },
      filters,
      "map",
    ),
    true,
  );
  for (const search of [
    { session: "anything" },
    { session: ["private", "group"] },
    { saved: "false" },
    { saved: ["1", "1"] },
  ])
    assert.equal(
      isCanonicalCoachDirectorySearch(
        search,
        normalizeCoachExploreFilters(search),
      ),
      false,
    );
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, { filters, view: "map" }),
  );
  assert.match(html, /<option value="group" selected="">Group/);
  assert.match(html, /name="saved" value="1"/);
  assert.match(html, /href="\/explore\?view=map"/);
});
