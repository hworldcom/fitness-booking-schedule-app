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
  return renderToStaticMarkup(
    createElement(CoachProfileView, {
      state: {
        status: "ready",
        coach: coach(trustKind),
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
