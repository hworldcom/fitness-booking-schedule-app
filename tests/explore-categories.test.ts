import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COACH_DISCIPLINES,
  coachDirectoryDisciplines,
  filterCoachDirectoryDisciplines,
} from "@/domain/coaches";
import {
  normalizeCoachExploreFilters,
  coachDirectoryHref,
  isCanonicalCoachDirectorySearch,
} from "@/features/coaches/marketplace-search-contract";
import { PublicMarketplaceSearch } from "@/features/coaches/public-marketplace-search";
import {
  normalizeHomeSearch,
  homeDirectoryHref,
} from "@/features/coaches/home-marketplace-contract";
import { directoryEntry } from "./fixtures/coach-directory";

test("multi-category matching is a union without duplicate coaches or input mutation", () => {
  const rows = [
    directoryEntry(1, "Boxer", { disciplines: ["Boxing"] }),
    directoryEntry(2, "Fitness", { disciplines: ["Fitness"] }),
    directoryEntry(3, "Both", { disciplines: ["Boxing", "Fitness"] }),
    directoryEntry(4, "Other", { disciplines: ["Wellness"] }),
  ];
  const filters = normalizeCoachExploreFilters({
    discipline: ["Fitness", "Boxing"],
  });
  assert.equal(filters.discipline, null);
  assert.deepEqual(coachDirectoryDisciplines(filters), ["Boxing", "Fitness"]);
  assert.deepEqual(
    filterCoachDirectoryDisciplines(rows, filters).map(
      (row) => row.coach.displayName,
    ),
    ["Boxer", "Fitness", "Both"],
  );
  assert.equal(
    filterCoachDirectoryDisciplines(rows, normalizeCoachExploreFilters({}))
      .length,
    4,
  );
  assert.equal(
    filterCoachDirectoryDisciplines(
      rows,
      normalizeCoachExploreFilters({ discipline: "Wrestling" }),
    ).length,
    0,
  );
  assert.equal(rows.length, 4);
});

test("repeated categories normalize aliases, duplicates and order into a bounded canonical set", () => {
  const raw = {
    discipline: [
      "fitness",
      "BJJ",
      "Boxing",
      "bjj",
      "Yoga",
      "constructor",
      "Boxing",
    ],
    q: "  footwork  ",
    location: " Berlin ",
    view: "map",
  };
  const filters = normalizeCoachExploreFilters(raw);
  assert.deepEqual(coachDirectoryDisciplines(filters), [
    "Boxing",
    "Brazilian Jiu-Jitsu",
    "Fitness",
  ]);
  const href = coachDirectoryHref(filters, {}, "map");
  assert.equal(
    href,
    "/explore?q=footwork&discipline=Boxing&discipline=Brazilian+Jiu-Jitsu&discipline=Fitness&location=Berlin&view=map",
  );
  assert.equal(isCanonicalCoachDirectorySearch(raw, filters, "map"), false);
  assert.equal(
    isCanonicalCoachDirectorySearch(
      {
        q: "footwork",
        discipline: ["Boxing", "Brazilian Jiu-Jitsu", "Fitness"],
        location: "Berlin",
        view: "map",
      },
      filters,
      "map",
    ),
    true,
  );
  assert.equal(
    isCanonicalCoachDirectorySearch(
      { discipline: ["Boxing", "Boxing"] },
      normalizeCoachExploreFilters({ discipline: ["Boxing", "Boxing"] }),
    ),
    false,
  );
  assert.equal(
    isCanonicalCoachDirectorySearch(
      { discipline: ["Fitness", "Boxing"] },
      normalizeCoachExploreFilters({ discipline: ["Fitness", "Boxing"] }),
    ),
    false,
  );
  assert.equal(
    isCanonicalCoachDirectorySearch(
      { q: ["one", "two"] },
      normalizeCoachExploreFilters({ q: ["one", "two"] }),
    ),
    false,
  );
  assert.deepEqual(
    coachDirectoryDisciplines(
      normalizeCoachExploreFilters({
        discipline: [...COACH_DISCIPLINES, ...COACH_DISCIPLINES],
      }),
    ),
    COACH_DISCIPLINES,
  );
});

test("category sets survive all other URL controls and can be cleared without dropping other filters", () => {
  const filters = normalizeCoachExploreFilters({
    q: "skills",
    discipline: ["Boxing", "Fitness"],
    location: "Berlin",
    session: "group",
    saved: "1",
  });
  assert.equal(
    coachDirectoryHref(filters, {}, "list"),
    "/explore?q=skills&discipline=Boxing&discipline=Fitness&location=Berlin&session=group&saved=1&view=list",
  );
  assert.equal(
    coachDirectoryHref(filters, { discipline: null }, "map"),
    "/explore?q=skills&location=Berlin&session=group&saved=1&view=map",
  );
  assert.equal(
    coachDirectoryHref(filters, { discipline: "Wellness" }),
    "/explore?q=skills&discipline=Wellness&location=Berlin&session=group&saved=1",
  );
  assert.equal(
    coachDirectoryHref(filters, { disciplines: [] }),
    "/explore?q=skills&location=Berlin&session=group&saved=1",
  );
  const singular = normalizeCoachExploreFilters({ discipline: "bjj" });
  assert.equal(singular.discipline, "Brazilian Jiu-Jitsu");
  assert.equal(
    coachDirectoryHref(singular),
    "/explore?discipline=Brazilian+Jiu-Jitsu",
  );
  const home = normalizeHomeSearch({
    discipline: ["Boxing", "Fitness"],
  }).filters;
  assert.equal(homeDirectoryHref(home), "/?discipline=Boxing");
});

test("native GET markup exposes all checkbox choices, applied count and only the selected successful values", () => {
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, {
      filters: normalizeCoachExploreFilters({
        discipline: ["Boxing", "Fitness"],
        q: "skills",
      }),
      view: "map",
    }),
  );
  const inputs = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(inputs.length, COACH_DISCIPLINES.length);
  const checked = inputs.filter((input) => input.includes('checked=""'));
  assert.equal(checked.length, 2);
  assert.ok(checked.some((input) => input.includes('value="Boxing"')));
  assert.ok(checked.some((input) => input.includes('value="Fitness"')));
  assert.match(html, /Categories, 2 selected/);
  assert.match(html, /Apply categories/);
  assert.match(html, /Clear selection/);
  assert.match(html, /Match any selected category/);
  assert.match(html, /name="view" value="map"/);
  assert.doesNotMatch(html, /<select[^>]*name="discipline"/);
});
