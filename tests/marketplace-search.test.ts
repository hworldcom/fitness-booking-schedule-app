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

test("canonical search rejects blank, repeated, legacy and unknown parameters", () => {
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

test("shared search renders one GET contract and supported discipline links", () => {
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, { filters: FILTERS }),
  );
  assert.match(html, /action="\/explore"/);
  assert.doesNotMatch(html, /method="post"/);
  assert.match(html, /aria-label="Search coaches"/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="discipline"/);
  assert.match(html, /name="location"/);
  assert.match(html, /aria-label="Browse coaches by discipline"/);
  const disciplineLinks = [
    ...html.matchAll(/<a[^>]*class="([^"]*)"[^>]*>/g),
  ].filter(([, classes]) =>
    classes.split(/\s+/).includes("home-discipline-shortcut"),
  );
  assert.equal(disciplineLinks.length, COACH_DISCIPLINES.length + 1);
  assert.match(html, /aria-current="page"[^>]*>[\s\S]*?Muay Thai/);
  assert.match(html, /id="explore-discipline"/);
  assert.match(html, /list="explore-discipline-suggestions"/);
  assert.match(
    html,
    /href="\/explore\?q=patient\+footwork&amp;discipline=Boxing&amp;location=Kreuzberg"/,
  );
  assert.doesNotMatch(html, /name="service"/);
  assert.doesNotMatch(html, /name="when"|price|rating|distance/i);
});

test("Home search omits coach query controls and query-bearing discipline links", () => {
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, {
      filters: FILTERS,
      includeQuery: false,
    }),
  );
  assert.match(html, /action="\/explore"/);
  assert.doesNotMatch(html, /method="post"/);
  assert.match(html, /name="discipline"/);
  assert.match(html, /name="location"[^>]*value="Kreuzberg"/);
  assert.match(
    html,
    /href="\/explore\?discipline=Boxing&amp;location=Kreuzberg"/,
  );
  assert.match(html, /href="\/explore\?location=Kreuzberg"/);
  assert.doesNotMatch(html, /name="q"|Search coach or focus|[?&](?:amp;)?q=/);
  assert.equal(FILTERS.query, "patient footwork");

  const queryOnly = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, {
      filters: normalizeCoachDirectoryFilters({ q: "footwork" }),
      includeQuery: false,
    }),
  );
  assert.doesNotMatch(queryOnly, /Clear search|name="q"|[?&](?:amp;)?q=/);
  assert.match(queryOnly, /aria-current="page"[^>]*>[\s\S]*?All disciplines/);
});

test("Explore typed disciplines use Home's aliases without accepting unsupported values", () => {
  for (const [value, expected] of [
    [" boxing ", "Boxing"],
    ["Muay   Thai", "Muay Thai"],
    ["BJJ", "Brazilian Jiu-Jitsu"],
    ["thai boxing", "Muay Thai"],
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

test("Explore's search, clear and discipline navigation retain explicit mobile view and applied filters", () => {
  for (const view of ["list", "map"] as const) {
    const html = renderToStaticMarkup(
      createElement(PublicMarketplaceSearch, { filters: FILTERS, view }),
    );
    assert.match(html, new RegExp('name="view"[^>]*value="' + view + '"'));
    assert.ok(html.includes('href="/explore?view=' + view + '"'));
    assert.ok(
      html.includes(
        'href="/explore?q=patient+footwork&amp;discipline=Boxing&amp;location=Kreuzberg&amp;view=' +
          view +
          '"',
      ),
    );
    assert.doesNotMatch(html, /id="home-discipline"|name="page"/);
  }
});
