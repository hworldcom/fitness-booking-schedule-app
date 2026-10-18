import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReviewCommand,
  parsePublicReview,
  parseReviewSummary,
} from "@/domain/coach-reviews";

const input = {
  action: "publish",
  bookingId: "93140000-0000-4000-8000-000000000001",
  rating: 4,
  comment: "Helpful coaching",
  attribution: "Athlete A",
  consent: true,
  expectedRevision: 0,
};
test("review commands require explicit consent, bounded plain text and exact fields", () => {
  assert.deepEqual(
    parseReviewCommand({ ...input, comment: "  Helpful\r\ncoaching  " }),
    { ...input, comment: "Helpful\ncoaching" },
  );
  assert.ok(parseReviewCommand({ ...input, comment: "🧤".repeat(2000) }));
  for (const bad of [
    { ...input, consent: false },
    { ...input, consent: 1 },
    { ...input, rating: 0 },
    { ...input, rating: 6 },
    { ...input, rating: 2.5 },
    { ...input, comment: "🧤".repeat(2001) },
    { ...input, comment: "<b>unsafe</b>" },
    { ...input, attribution: "A" },
    { ...input, attribution: "A\nB" },
    { ...input, comment: "hidden\u200btext" },
    { ...input, expectedRevision: -1 },
    { ...input, expectedRevision: 2147483647 },
    { ...input, athleteId: "forged" },
    { ...input, moderationHidden: false },
    { ...input, bookingId: "bad" },
  ])
    assert.equal(parseReviewCommand(bad), null);
  assert.deepEqual(
    parseReviewCommand({
      action: "withdraw",
      coachSlug: "daniel-park",
      expectedRevision: 1,
    }),
    { action: "withdraw", coachSlug: "daniel-park", expectedRevision: 1 },
  );
  assert.equal(
    parseReviewCommand({
      action: "withdraw",
      coachSlug: "daniel-park",
      expectedRevision: 1,
      consent: true,
    }),
    null,
  );
  assert.ok(
    parseReviewCommand({
      action: "hide",
      reviewId: input.bookingId,
      reason: "Operator reason",
      expectedRevision: 2,
    }),
  );
  assert.equal(
    parseReviewCommand({
      action: "restore",
      reviewId: input.bookingId,
      reason: "",
      expectedRevision: 2,
    }),
    null,
  );
});
test("public review mapping only returns consented publication fields", () => {
  const published = {
    rating: 5,
    comment: "Good",
    attribution: "Chosen name",
    createdAt: "2026-10-18T12:00:00.123456+00:00",
    updatedAt: "2026-10-18T12:00:00Z",
  };
  assert.deepEqual(
    parsePublicReview({
      ...published,
      athleteId: "private",
      bookingId: input.bookingId,
      legalName: "Private Legal Name",
      avatar: "private",
    }),
    published,
  );
  assert.equal(parsePublicReview({ ...published, attribution: "" }), null);
  assert.equal(parsePublicReview({ ...published, rating: "5" }), null);
  assert.equal(parsePublicReview({ ...published, createdAt: "bad" }), null);
});
test("review summaries distinguish no reviews from scores and require truthful fixture labels", () => {
  assert.deepEqual(
    parseReviewSummary({ count: 0, mean: null, fictional: false }),
    { count: 0, mean: null, fictional: false },
  );
  assert.ok(parseReviewSummary({ count: 3, mean: 3.7, fictional: true }));
  for (const summary of [
    { count: 0, mean: 0, fictional: true },
    { count: 1, mean: null, fictional: false },
    { count: 2, mean: 3.75, fictional: false },
    { count: -1, mean: 5, fictional: false },
    { count: 1, mean: NaN, fictional: false },
    { count: 1, mean: 5 },
  ])
    assert.equal(parseReviewSummary(summary), null);
});
