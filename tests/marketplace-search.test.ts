import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COACH_DISCIPLINES,
  normalizeCoachDirectoryFilters,
} from "@/domain/coaches";
import {
  coachDirectoryHref,
  isCanonicalCoachDirectorySearch,
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
  ]) {
    assert.equal(
      isCanonicalCoachDirectorySearch(
        searchParams,
        normalizeCoachDirectoryFilters(searchParams),
      ),
      false,
    );
  }

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
  assert.match(html, /method="get"/);
  assert.match(html, /aria-label="Search coaches"/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="discipline"/);
  assert.match(html, /name="location"/);
  assert.match(html, /aria-label="Browse coaches by discipline"/);
  const disciplineChips = [
    ...html.matchAll(/<a[^>]*class="([^"]*)"[^>]*>/g),
  ].filter(([, classNames]) =>
    classNames.split(/\s+/).includes("marketplace-discipline-chip"),
  );
  assert.equal(disciplineChips.length, COACH_DISCIPLINES.length + 1);
  assert.match(html, /aria-current="page"[^>]*>Muay Thai/);
  assert.match(
    html,
    /href="\/explore\?q=patient\+footwork&amp;discipline=Boxing&amp;location=Kreuzberg"/,
  );
  assert.doesNotMatch(html, /name="service"/);
  assert.doesNotMatch(html, /name="when"|price|rating|distance/i);
});
