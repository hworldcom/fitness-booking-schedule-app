import "server-only";
import { sql } from "drizzle-orm";
import {
  parsePublicReview,
  parseReviewSummary,
  reviewObject,
  reviewRevision,
  REVIEW_UUID,
  reviewTimestamp,
  type ReviewCommand,
  type ReviewCommandResult,
  type ReviewState,
  type ReviewPageResult,
  type ReviewPosition,
  type ReviewSummary,
} from "@/domain/coach-reviews";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

function state(value: Record<string, unknown>): ReviewState {
  if (
    typeof value.eligible !== "boolean" ||
    !(value.status === "ready" || value.status === "saved")
  )
    throw new Error("Invalid review state.");
  if (value.review === null)
    return { status: value.status, eligible: value.eligible, review: null };
  const row = value.review,
    publicFields = parsePublicReview(row);
  if (
    !reviewObject(row) ||
    !publicFields ||
    typeof row.id !== "string" ||
    !REVIEW_UUID.test(row.id) ||
    typeof row.published !== "boolean" ||
    typeof row.moderationHidden !== "boolean" ||
    !reviewRevision(row.revision) ||
    row.revision < 1
  )
    throw new Error("Invalid owned review.");
  return {
    status: value.status,
    eligible: value.eligible,
    review: {
      ...publicFields,
      id: row.id,
      published: row.published,
      moderationHidden: row.moderationHidden,
      revision: row.revision,
    },
  };
}
function commandResult(value: unknown): ReviewCommandResult {
  if (!reviewObject(value)) throw new Error("Invalid review result.");
  if (
    value.status === "ready" ||
    (value.status === "saved" && "eligible" in value)
  )
    return state(value);
  if (
    value.status === "saved" &&
    reviewRevision(value.revision) &&
    value.revision > 0
  )
    return { status: "saved", revision: value.revision };
  if (
    value.status === "invalid" ||
    value.status === "conflict" ||
    value.status === "not-eligible" ||
    value.status === "not-found" ||
    value.status === "forbidden"
  )
    return { status: value.status };
  throw new Error("Invalid review result.");
}
export async function currentCoachReviewRecord(
  transaction: ActorDatabaseTransaction,
  slug: string,
) {
  const rows = await transaction.execute<{ result: unknown }>(
    sql`select app.current_coach_pair_review(${slug}::text) as result`,
  );
  return commandResult(rows[0]?.result);
}
export async function mutateCoachReviewRecord(
  transaction: ActorDatabaseTransaction,
  input: ReviewCommand,
) {
  const rows = await transaction.execute<{ result: unknown }>(
    sql`select app.mutate_coach_pair_review(${JSON.stringify(input)}::jsonb) as result`,
  );
  return commandResult(rows[0]?.result);
}
export function encodeReviewCursor(position: ReviewPosition): string {
  return Buffer.from(JSON.stringify(position)).toString("base64url");
}
export function decodeReviewCursor(
  value: string | null,
): ReviewPosition | null | undefined {
  if (value === null) return null;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) return undefined;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    return reviewObject(decoded) &&
      Object.keys(decoded).sort().join(",") === "createdAt,id" &&
      reviewTimestamp(decoded.createdAt) &&
      typeof decoded.id === "string" &&
      REVIEW_UUID.test(decoded.id) &&
      encodeReviewCursor({ createdAt: decoded.createdAt, id: decoded.id }) ===
        value
      ? { createdAt: decoded.createdAt, id: decoded.id }
      : undefined;
  } catch {
    return undefined;
  }
}
export async function publicCoachReviewPageRecord(
  slug: string,
  position: ReviewPosition | null,
): Promise<ReviewPageResult> {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{ result: unknown }>(
      sql`select app.public_coach_review_page(${slug}::text,${position?.createdAt ?? null}::timestamptz,${position?.id ?? null}::uuid) result`,
    );
    const value = rows[0]?.result;
    if (!reviewObject(value)) throw new Error("Invalid public reviews.");
    if (value.status === "not-found" || value.status === "invalid")
      return { status: value.status };
    const summary = parseReviewSummary(value.summary);
    if (
      value.status !== "ready" ||
      !summary ||
      !Array.isArray(value.reviews) ||
      value.reviews.length > 20
    )
      throw new Error("Invalid public reviews.");
    const reviews = value.reviews.map(parsePublicReview);
    if (reviews.some((x) => x === null))
      throw new Error("Invalid public review.");
    let nextCursor: string | null = null;
    if (value.position !== null) {
      if (
        !reviewObject(value.position) ||
        !reviewTimestamp(value.position.createdAt) ||
        typeof value.position.id !== "string" ||
        !REVIEW_UUID.test(value.position.id)
      )
        throw new Error("Invalid review position.");
      nextCursor = encodeReviewCursor({
        createdAt: value.position.createdAt,
        id: value.position.id,
      });
    }
    return {
      status: "ready",
      summary,
      reviews: reviews as NonNullable<(typeof reviews)[number]>[],
      nextCursor,
    };
  });
}
export async function publicCoachReviewSummaryRecords(
  slugs: readonly string[],
): Promise<ReadonlyMap<string, ReviewSummary>> {
  return withDatabaseConnection(async ({ db }) => {
    const result = new Map<string, ReviewSummary>();
    for (let start = 0; start < slugs.length; start += 64) {
      const batch = slugs.slice(start, start + 64);
      const rows = await db.execute<{ slug: string; summary: unknown }>(
        sql`select * from app.public_coach_review_summaries(array(select jsonb_array_elements_text(${JSON.stringify(batch)}::jsonb)))`,
      );
      for (const row of rows) {
        const summary = parseReviewSummary(row.summary);
        if (!summary || !batch.includes(row.slug))
          throw new Error("Invalid review summary.");
        result.set(row.slug, summary);
      }
    }
    return result;
  });
}
