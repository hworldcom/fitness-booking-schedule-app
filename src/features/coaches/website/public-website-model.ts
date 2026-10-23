import {
  parsePublicReview,
  parseReviewSummary,
  type ReviewPageResult,
} from "@/domain/coach-reviews";

/** Re-project the API response so extra/private fields never enter component state. */
export function parsePublicReviewPage(
  value: unknown,
): Extract<ReviewPageResult, { status: "ready" }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const summary = parseReviewSummary(v.summary);
  if (
    v.status !== "ready" ||
    !summary ||
    !Array.isArray(v.reviews) ||
    v.reviews.length > 20 ||
    !(
      v.nextCursor === null ||
      (typeof v.nextCursor === "string" &&
        /^[A-Za-z0-9_-]{1,512}$/.test(v.nextCursor))
    )
  )
    return null;
  const reviews = v.reviews.map(parsePublicReview);
  if (
    reviews.some((r) => r === null) ||
    (v.nextCursor !== null && reviews.length === 0)
  )
    return null;
  return {
    status: "ready",
    summary,
    reviews: reviews as NonNullable<(typeof reviews)[number]>[],
    nextCursor: v.nextCursor as string | null,
  };
}
