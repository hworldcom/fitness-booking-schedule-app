import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { publicCoachStartingRate } from "@/domain/coach-starting-rate";
import { CompactCoachCard } from "@/features/coaches/compact-coach-card";
import { directoryEntry } from "./fixtures/coach-directory";

const original = directoryEntry(1, "Public Coach");
const entry: CoachDirectoryEntry = {
  ...original,
  coach: { ...original.coach, publicPath: "/@public_coach" },
  website: {
    schemaVersion: 1,
    revision: 3,
    brandLabel: "Public training studio",
    introduction:
      "Build confidence through balanced footwork and clear feedback.",
    focusLabels: ["Footwork", "Beginner confidence"],
    banner: {
      url: "/api/coaches/public-coach/website/banner/card?v=3",
      width: 800,
      height: 300,
    },
    startingRate: publicCoachStartingRate(6050),
  },
  reviewSummary: { count: 2, mean: 4.5, fictional: false },
  areaLabel: "Kreuzberg, Berlin",
};
const render = (
  value: CoachDirectoryEntry,
  variant: "marketplace" | "result" | "preview",
) =>
  renderToStaticMarkup(
    createElement(CompactCoachCard, {
      entry: value,
      variant,
      onShowOnMap: () => undefined,
      availabilityLimit: 5,
    }),
  );

test("all public card consumers use saved content, public rates, pair summaries and canonical links", () => {
  for (const variant of ["marketplace", "result", "preview"] as const) {
    const html = render(entry, variant);
    for (const text of [
      "balanced footwork",
      "Beginner confidence",
      "Sessions start from €60.50",
      "4.5 out of 5 from 2 reviews",
    ])
      assert.ok(html.includes(text), text);
    if (variant === "marketplace") {
      assert.match(
        html,
        /aria-label="View Public Coach&#x27;s coach profile — Kreuzberg, Berlin"/,
      );
      assert.match(
        html,
        /<h3>Public Coach<\/h3><small class="coach-card-area">Kreuzberg, Berlin<\/small>/,
      );
      assert.doesNotMatch(
        html,
        /Public training studio|Private coaching|Primary training place|Primary training location/,
      );
    } else {
      assert.match(html, /Public training studio/);
      assert.match(html, /Private coaching/);
    }
    assert.match(
      html,
      /src="\/api\/coaches\/public-coach\/website\/banner\/card\?v=3"/,
    );
    assert.match(html, /loading="lazy"/);
    assert.match(html, /href="\/@public_coach"/);
    assert.doesNotMatch(
      html,
      /banner\/hero|gallery|<a[^>]*>(?:(?!<\/a>)[\s\S])*<button/,
    );
    assert.match(html, /<\/button><a class="compact-coach-link"/);
  }
});

test("absent content has initials and legacy links without a price, fabricated rating or biography", () => {
  const html = render(original, "marketplace");
  assert.match(html, />PC<\/span>/);
  assert.match(html, /href="\/coaches\/public-coach"/);
  assert.doesNotMatch(
    html,
    /Reviews unavailable|No reviews yet|coach-card-reviews/,
  );
  assert.doesNotMatch(
    html,
    /Sessions start from|€|out of 5|No reviews yet|focused private training|coach-card-banner/,
  );
});

test("zero price is Free while absent public amount is never inferred from owner-like extra fields", () => {
  const free = render(
    {
      ...entry,
      website: { ...entry.website!, startingRate: publicCoachStartingRate(0) },
    },
    "result",
  );
  assert.match(free, /Sessions start from €0 \(Free\)/);
  const { startingRate: removed, ...publicWebsite } = entry.website!;
  assert.ok(removed);
  const hidden = render(
    {
      ...entry,
      website: {
        ...publicWebsite,
        ownerAmountCents: 999999,
        disclose: false,
      } as typeof publicWebsite,
    },
    "result",
  );
  assert.doesNotMatch(
    hidden,
    /999999|€|Sessions start from|ownerAmountCents|disclose/,
  );
});

test("successful zero, unavailable and fictional review populations remain distinct", () => {
  const zero = render(
    { ...entry, reviewSummary: { count: 0, mean: null, fictional: false } },
    "result",
  );
  assert.match(zero, /No reviews yet/);
  assert.doesNotMatch(zero, /out of 5|Reviews unavailable|Demo reviews/);
  const failure = render({ ...entry, reviewSummary: null }, "result");
  assert.match(failure, /Reviews unavailable/);
  assert.doesNotMatch(failure, /No reviews yet|out of 5/);
  const demo = render(
    { ...entry, reviewSummary: { count: 1, mean: 5, fictional: true } },
    "preview",
  );
  assert.match(demo, /Demo reviews: 5.0 out of 5 from 1 review/);
  assert.match(demo, /· Demo reviews/);
});

test("Home omits empty review rows and redundant labels while positive sample reviews retain accessible context", () => {
  for (const reviewSummary of [
    null,
    { count: 0, mean: null, fictional: true },
  ]) {
    const html = render({ ...entry, reviewSummary }, "marketplace");
    assert.doesNotMatch(
      html,
      /Private coaching|Public training studio|Demo reviews|No reviews yet|Reviews unavailable|coach-card-reviews|Primary training/,
    );
    assert.match(html, /Kreuzberg, Berlin/);
  }
  const positive = render(
    { ...entry, reviewSummary: { count: 1, mean: 5, fictional: true } },
    "marketplace",
  );
  assert.match(positive, /Fictional demo coach: 5.0 out of 5 from 1 review/);
  assert.match(positive, /Demo coach/);
  assert.doesNotMatch(positive, /Demo reviews/);
});

test("long content stays escaped and available as text with independent map actions", () => {
  const longName = "Long public coach name ".repeat(4);
  const long = render(
    {
      ...entry,
      coach: { ...entry.coach, displayName: longName },
      website: {
        ...entry.website!,
        introduction:
          '<script>alert("test")</script>' + " useful feedback".repeat(20),
      },
    },
    "result",
  );
  assert.ok(long.includes(longName));
  assert.match(long, /&lt;script&gt;/);
  assert.doesNotMatch(long, /<script>|<a[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
  assert.match(long, /aria-label="Show Long public coach name/);
});

test("map preview retains five actual venues while result cards show one and Home shows no times", () => {
  const available = directoryEntry(2, "Venue Coach", {
    withAvailability: true,
  });
  const slot = available.todaySlots[0]!;
  const withTimes = {
    ...entry,
    todaySlots: Array.from({ length: 6 }, (_, i) => ({
      ...slot,
      id: `slot-${i}`,
      location: { ...slot.location, name: `Actual venue ${i + 1}` },
    })),
  };
  const preview = render(withTimes, "preview");
  assert.match(preview, /Actual venue 5/);
  assert.doesNotMatch(preview, /Actual venue 6/);
  assert.match(preview, /\+1 more open time today/);
  const result = renderToStaticMarkup(
    createElement(CompactCoachCard, { entry: withTimes, variant: "result" }),
  );
  assert.match(result, /Actual venue 1/);
  assert.doesNotMatch(result, /Actual venue 2/);
  assert.match(result, /\+5 more open times today/);
  assert.doesNotMatch(
    render(withTimes, "marketplace"),
    /Actual venue|open times/,
  );
});
