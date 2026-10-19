import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COACH_DISCIPLINES,
  normalizeCoachDirectoryFilters,
  validateCoachProfileInput,
} from "@/domain/coaches";
import {
  marketplaceDiscipline,
  DISCIPLINE_SEARCH_PATTERN,
} from "@/features/coaches/discipline-search-contract";
import {
  homeDirectoryHref,
  normalizeHomeSearch,
} from "@/features/coaches/home-marketplace-contract";
import { PublicMarketplaceSearch } from "@/features/coaches/public-marketplace-search";
import { fitnessDemoCoachSeedSql } from "../scripts/lib/demo-coach-fixtures";
import { seedBeforeFitness } from "../scripts/lib/seed-compatibility.mjs";

test("Fitness works across canonical filtering, shortcut selection and owner validation", () => {
  assert.ok(COACH_DISCIPLINES.includes("Fitness"));
  assert.equal(marketplaceDiscipline("  fItNeSs "), "Fitness");
  assert.equal(marketplaceDiscipline("Yoga"), null);
  const pattern = new RegExp("^(?:" + DISCIPLINE_SEARCH_PATTERN + ")$");
  assert.equal(pattern.test("fitness"), true);
  assert.equal(pattern.test("Yoga"), false);
  const { filters: search } = normalizeHomeSearch({ discipline: "fitness" });
  assert.equal(search.discipline, "Fitness");
  assert.equal(homeDirectoryHref(search), "/?discipline=Fitness");
  assert.equal(
    normalizeCoachDirectoryFilters({ discipline: "Fitness" }).discipline,
    "Fitness",
  );
  assert.equal(normalizeCoachDirectoryFilters({}).discipline, null);
  const html = renderToStaticMarkup(
    createElement(PublicMarketplaceSearch, {
      filters: normalizeCoachDirectoryFilters({ discipline: "Fitness" }),
    }),
  );
  assert.match(html, /type="hidden" name="discipline" value="Fitness"/);
  assert.match(
    html,
    /aria-current="page"[^>]*href="\/explore\?discipline=Fitness"/,
  );
  const input = {
    displayName: "Fitness Coach",
    bio: "Approachable strength and conditioning with practical feedback and steady progress.",
    disciplines: ["Fitness"],
    timezone: "Europe/Berlin",
    visibility: "visible",
    selectedGymId: "40000000-0000-4000-8000-000000000002",
  };
  assert.equal(validateCoachProfileInput(input).valid, true);
  assert.equal(
    validateCoachProfileInput({ ...input, disciplines: ["Yoga"] }).valid,
    false,
  );
});

test("additive seed extraction requires one exact bounded block", () => {
  const seed = readFileSync("supabase/seed.sql", "utf8");
  const block = fitnessDemoCoachSeedSql(seed);
  assert.match(block, /jake-miller/);
  assert.doesNotMatch(
    block,
    /daniel-park|sam-lee|nora-klein|idris-malik|elif-demir/,
  );
  const historical = seedBeforeFitness(seed);
  assert.doesNotMatch(historical, /jake-miller|BEGIN DEV0336/);
  assert.ok(historical.includes("daniel-park"));
  assert.throws(() => seedBeforeFitness(""), /one exact/);
  for (const malformed of [
    "",
    seed.replace("-- END DEV0336 FITNESS COACH", ""),
    seed + "\n-- BEGIN DEV0336 FITNESS COACH",
    seed + "\n-- END DEV0336 FITNESS COACH",
  ])
    assert.throws(() => fitnessDemoCoachSeedSql(malformed), /exact additive/);
});
