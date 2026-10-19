import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PUBLIC_SCHEDULE_COACH as coach } from "./fixtures/public-schedule-data";
import { PublicCoachWebsite } from "@/features/coaches/website/public-coach-website";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  projectCoachWebsite,
} from "@/domain/coach-website";
import { publicCoachStartingRate } from "@/domain/coach-starting-rate";
import {
  publicWebsiteIdentity,
  parsePublicReviewPage,
  loadCoachPublicGroups,
} from "@/features/coaches/website/public-website-model";
import type { GroupSession } from "@/domain/group-sessions";
import type { SessionType } from "@/domain/session-types";

const content = {
  ...EMPTY_COACH_WEBSITE_CONTENT,
  brandLabel: "Deliberate practice",
  introduction: "Find a rhythm that works for you.",
  approach: "Build confidence, one session at a time.",
  experience: "Coach-supplied qualification claim",
  focusLabels: ["Beginners"],
  faqs: [{ question: "What should I bring?", answer: "Comfortable shoes." }],
  links: [{ label: "My coaching story", url: "https://example.org/coaching" }],
};
const website = projectCoachWebsite(
  content,
  2,
  true,
  coach.slug,
  publicCoachStartingRate(4500),
);
const page = (
  options: Partial<Parameters<typeof PublicCoachWebsite>[0]> = {},
) =>
  renderToStaticMarkup(
    createElement(PublicCoachWebsite, {
      state: { status: "ready", coach, slots: [], website },
      marketplace: createElement(
        "section",
        { id: "private-schedule" },
        "Existing booking engine",
      ),
      origin: "https://movx.test",
      ...options,
    }),
  );
const review = {
  rating: 5,
  comment: "Public feedback",
  attribution: "Consented athlete",
  createdAt: "2026-10-18T12:00:00Z",
  updatedAt: "2026-10-18T12:00:00Z",
};
const reviews = {
  status: "ready",
  summary: { count: 1, mean: 5, fictional: true },
  reviews: [review],
  nextCursor: null,
} as const;

test("real public content, optional sections, FAQ, safe external links and bounded trust render", () => {
  const html = page({ reviews });
  for (const text of [
    content.brandLabel,
    content.introduction,
    content.approach,
    content.experience,
    content.focusLabels[0],
    content.faqs[0].question,
    "Coach-provided information",
    "Sessions start from",
    "45",
    "Consented athlete",
    "Fictional demo reviews",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /<details><summary>What should I bring/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.equal((html.match(/id="private-schedule"/g) ?? []).length, 1);
  assert.equal((html.match(/id="reviews"/g) ?? []).length, 1);
  assert.match(html, /Existing booking engine/);
  assert.doesNotMatch(html, /api\/coach\/website/);
});
test("old profiles keep biography and omit empty optional sections, nav, images and amounts", () => {
  const html = page({
    state: {
      status: "ready",
      coach: { ...coach, portraitUrl: null },
      slots: [],
    },
  });
  assert.ok(html.includes(coach.bio));
  for (const id of ["approach", "experience", "questions"])
    assert.ok(!html.includes(`href="#${id}"`) && !html.includes(`id="${id}"`));
  assert.doesNotMatch(html, /Sessions start from|<img|undefined|NaN/);
  assert.match(html, /Make space for progress/);
});
test("zero rate remains Free; hidden rate never enters rendered content or share identity", () => {
  const hidden = projectCoachWebsite(content, 3, false, coach.slug);
  const html = page({
    state: { status: "ready", coach, slots: [], website: hidden },
  });
  assert.doesNotMatch(html, /4500|45\.00|Sessions start from/);
  const zero = projectCoachWebsite(
    content,
    4,
    false,
    coach.slug,
    publicCoachStartingRate(0),
  );
  assert.match(
    page({ state: { status: "ready", coach, slots: [], website: zero } }),
    /Free/,
  );
  assert.deepEqual(
    publicWebsiteIdentity(coach, hidden, "https://movx.test"),
    publicWebsiteIdentity(coach, zero, "https://movx.test"),
  );
});
test("canonical share identity uses confirmed path or legacy fallback without date/query or rates", () => {
  const confirmed = { ...coach, publicPath: "/@public_coach" };
  const identity = publicWebsiteIdentity(
    confirmed,
    website,
    "https://movx.test",
  );
  assert.equal(identity.url, "https://movx.test/@public_coach");
  assert.equal(identity.description, content.introduction);
  assert.ok(identity.image?.startsWith("https://movx.test/api/coaches/"));
  assert.equal(publicWebsiteIdentity(coach, undefined, null).url, null);
  assert.equal(
    publicWebsiteIdentity(
      { ...coach, publicPath: "https://evil.test" },
      undefined,
      "https://movx.test",
    ).path,
    `/coaches/${coach.slug}`,
  );
});
test("only actual active bookable types render with real duration; no default offer is invented", () => {
  const type = {
    id: "x",
    format: "private",
    name: "Actual 75 minute session",
    description: "Real description",
    durationMinutes: 75,
    archived: false,
    bookable: true,
    revision: 1,
    color: "#61417b",
    defaultLocationId: null,
  } as SessionType;
  const html = page({
    catalog: {
      enabled: true,
      types: [
        type,
        { ...type, id: "hidden", name: "HiddenTypeCanary", bookable: false },
        { ...type, id: "archived", name: "ArchivedTypeCanary", archived: true },
      ],
      locations: [],
    },
  });
  assert.match(html, /Actual 75 minute session/);
  assert.match(html, /75/);
  assert.doesNotMatch(html, /HiddenTypeCanary|ArchivedTypeCanary/);
  assert.match(
    page({ catalog: { enabled: true, types: [], locations: [] } }),
    /No publicly bookable session types/,
  );
  assert.match(
    page({ catalog: { enabled: false, types: [], locations: [] } }),
    /Check private availability/,
  );
  assert.match(page(), /Session types are unavailable/);
});
test("review empty and failure anchors stay stable and self-profile never offers self messaging", () => {
  const empty = page({
    ownProfile: true,
    reviews: {
      ...reviews,
      reviews: [],
      summary: { count: 0, mean: null, fictional: false },
    },
  });
  assert.match(empty, /id="reviews"/);
  assert.match(empty, /No public reviews yet/);
  assert.doesNotMatch(empty, /href="\/messages/);
  assert.match(page(), /Reviews are unavailable/);
  assert.match(page(), /Retry reviews/);
  assert.match(
    page({ groups: { status: "ready", sessions: [] } }),
    /No upcoming public group sessions/,
  );
  assert.match(page(), /couldn’t load this coach’s group sessions/);
});
test("review response parser bounds pages and strips private identity even from malformed extra fields", () => {
  const parsed = parsePublicReviewPage({
    ...reviews,
    reviews: [{ ...review, email: "private@example.test", avatar: "private" }],
  });
  assert.ok(parsed);
  assert.doesNotMatch(JSON.stringify(parsed), /private/);
  assert.equal(
    parsePublicReviewPage({ ...reviews, reviews: Array(21).fill(review) }),
    null,
  );
  assert.equal(
    parsePublicReviewPage({ ...reviews, nextCursor: "javascript:bad" }),
    null,
  );
  assert.equal(
    parsePublicReviewPage({ ...reviews, reviews: [], nextCursor: "abc" }),
    null,
  );
  assert.equal(
    parsePublicReviewPage({
      ...reviews,
      summary: { count: 1, mean: 6, fictional: false },
    }),
    null,
  );
});
const group = (slug: string, id: string) =>
  ({ id, coach: { slug } }) as GroupSession;
test("coach groups match exact coach across public pages, never global or prefix matches", async () => {
  let calls = 0;
  const result = await loadCoachPublicGroups("mine", async (after) => {
    calls++;
    return after
      ? { items: [group("mine", "second")], nextCursor: null }
      : {
          items: [group("mine-other", "foreign"), group("mine", "first")],
          nextCursor: { at: "2026-10-20T00:00:00Z", id: "cursor" },
        };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, {
    status: "ready",
    sessions: [group("mine", "first"), group("mine", "second")],
  });
});
test("group failed, repeated-cursor and bounded-incomplete reads cannot claim no groups", async () => {
  assert.deepEqual(await loadCoachPublicGroups("mine", async () => null), {
    status: "unavailable",
  });
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => {
      throw Error("offline");
    }),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => ({
      items: [],
      nextCursor: { at: "now", id: "same" },
    })),
    { status: "unavailable" },
  );
  let calls = 0;
  assert.deepEqual(
    await loadCoachPublicGroups("mine", async () => ({
      items: [],
      nextCursor: { at: "now", id: String(++calls) },
    })),
    { status: "unavailable" },
  );
  assert.equal(calls, 20);
});
