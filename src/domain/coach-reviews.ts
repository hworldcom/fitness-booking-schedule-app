import { isCoachPublicSlug } from "./coaches";

export type ReviewFailure = Readonly<{
  status:
    | "invalid"
    | "conflict"
    | "not-eligible"
    | "not-found"
    | "signed-out"
    | "forbidden"
    | "unavailable";
}>;
export type PublishReview = Readonly<{
  action: "publish";
  bookingId: string;
  rating: number;
  comment: string;
  attribution: string;
  consent: true;
  expectedRevision: number;
}>;
export type WithdrawReview = Readonly<{
  action: "withdraw";
  coachSlug: string;
  expectedRevision: number;
}>;
export type ModerateReview = Readonly<{
  action: "hide" | "restore";
  reviewId: string;
  reason: string;
  expectedRevision: number;
}>;
export type ReviewCommand = PublishReview | WithdrawReview | ModerateReview;
export type PublicReview = Readonly<{
  rating: number;
  comment: string;
  attribution: string;
  createdAt: string;
  updatedAt: string;
}>;
export type OwnedReview = PublicReview &
  Readonly<{
    id: string;
    published: boolean;
    moderationHidden: boolean;
    revision: number;
  }>;
export type ReviewSummary = Readonly<{
  count: number;
  mean: number | null;
  fictional: boolean;
}>;
export type ReviewState = Readonly<{
  status: "ready" | "saved";
  eligible: boolean;
  review: OwnedReview | null;
}>;
export type ReviewCommandResult =
  ReviewState | Readonly<{ status: "saved"; revision: number }> | ReviewFailure;
export type ReviewPageResult =
  | Readonly<{
      status: "ready";
      summary: ReviewSummary;
      reviews: readonly PublicReview[];
      nextCursor: string | null;
    }>
  | ReviewFailure;
export type ReviewPosition = Readonly<{ createdAt: string; id: string }>;

export const REVIEW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const reviewRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= 2147483647;
export const reviewObject = (
  value: unknown,
): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string) =>
  Object.keys(value).sort().join(",") === keys;
export function reviewText(
  value: unknown,
  maximum: number,
  minimum = 0,
  singleLine = false,
): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (
    [...text].length < minimum ||
    [...text].length > maximum ||
    /[<>\p{Cc}\p{Cf}\u2028\u2029]/u.test(text.replace(/\n/g, "")) ||
    (singleLine && /[\n\t]/u.test(text))
  )
    return null;
  return text;
}
export function parseReviewCommand(value: unknown): ReviewCommand | null {
  if (
    !reviewObject(value) ||
    !reviewRevision(value.expectedRevision) ||
    value.expectedRevision === 2147483647
  )
    return null;
  const expectedRevision = value.expectedRevision;
  if (
    value.action === "publish" &&
    exact(
      value,
      "action,attribution,bookingId,comment,consent,expectedRevision,rating",
    )
  ) {
    const comment = reviewText(value.comment, 2000),
      attribution = reviewText(value.attribution, 80, 2, true);
    return typeof value.bookingId === "string" &&
      REVIEW_UUID.test(value.bookingId) &&
      value.consent === true &&
      Number.isInteger(value.rating) &&
      (value.rating as number) >= 1 &&
      (value.rating as number) <= 5 &&
      comment !== null &&
      attribution !== null
      ? {
          action: "publish",
          bookingId: value.bookingId,
          rating: value.rating as number,
          comment,
          attribution,
          consent: true,
          expectedRevision,
        }
      : null;
  }
  if (
    value.action === "withdraw" &&
    exact(value, "action,coachSlug,expectedRevision") &&
    typeof value.coachSlug === "string" &&
    isCoachPublicSlug(value.coachSlug)
  )
    return { action: "withdraw", coachSlug: value.coachSlug, expectedRevision };
  if (
    (value.action === "hide" || value.action === "restore") &&
    exact(value, "action,expectedRevision,reason,reviewId")
  ) {
    const reason = reviewText(value.reason, 500, 2);
    return typeof value.reviewId === "string" &&
      REVIEW_UUID.test(value.reviewId) &&
      reason !== null
      ? {
          action: value.action,
          reviewId: value.reviewId,
          reason,
          expectedRevision,
        }
      : null;
  }
  return null;
}
export function reviewTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts =
    /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(
      value,
    );
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    hour < 24 &&
    minute < 60 &&
    second < 60
  );
}
export function parsePublicReview(value: unknown): PublicReview | null {
  if (
    !reviewObject(value) ||
    !Number.isInteger(value.rating) ||
    (value.rating as number) < 1 ||
    (value.rating as number) > 5 ||
    !reviewTimestamp(value.createdAt) ||
    !reviewTimestamp(value.updatedAt)
  )
    return null;
  const comment = reviewText(value.comment, 2000),
    attribution = reviewText(value.attribution, 80, 2, true);
  return comment !== null &&
    comment === value.comment &&
    attribution !== null &&
    attribution === value.attribution
    ? {
        rating: value.rating as number,
        comment,
        attribution,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      }
    : null;
}
export function parseReviewSummary(value: unknown): ReviewSummary | null {
  if (
    !reviewObject(value) ||
    !Number.isSafeInteger(value.count) ||
    (value.count as number) < 0 ||
    typeof value.fictional !== "boolean"
  )
    return null;
  const count = value.count as number,
    mean = value.mean;
  if (
    (count === 0 && mean !== null) ||
    (count > 0 &&
      (typeof mean !== "number" ||
        !Number.isFinite(mean) ||
        mean < 1 ||
        mean > 5 ||
        Math.abs(mean * 10 - Math.round(mean * 10)) > 1e-9))
  )
    return null;
  return { count, mean: mean as number | null, fictional: value.fictional };
}
