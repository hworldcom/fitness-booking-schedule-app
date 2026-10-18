import "server-only";
import { isCoachPublicSlug } from "@/domain/coaches";
import {
  parseReviewCommand,
  type ReviewCommandResult,
  type ReviewPageResult,
  type ReviewSummary,
} from "@/domain/coach-reviews";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  currentCoachReviewRecord,
  mutateCoachReviewRecord,
  publicCoachReviewPageRecord,
  publicCoachReviewSummaryRecords,
  decodeReviewCursor,
} from "@/server/db/coaches/review-repository";

export async function currentCoachReview(
  slug: string,
): Promise<ReviewCommandResult> {
  if (!isCoachPublicSlug(slug)) return { status: "invalid" };
  const result = await withAuthorizedActor((tx) =>
    currentCoachReviewRecord(tx, slug),
  );
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "unavailable" : result.status };
}
export async function commandCoachReview(
  input: unknown,
  moderation = false,
): Promise<ReviewCommandResult> {
  const command = parseReviewCommand(input);
  if (
    !command ||
    moderation !== (command.action === "hide" || command.action === "restore")
  )
    return { status: "invalid" };
  const result = await withAuthorizedActor((tx, actor) => {
    if (moderation && actor.runRole !== "operator")
      return Promise.resolve({ status: "forbidden" as const });
    return mutateCoachReviewRecord(tx, command);
  });
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "unavailable" : result.status };
}
export async function publicCoachReviews(
  slug: string,
  cursor: string | null,
): Promise<ReviewPageResult> {
  if (!isCoachPublicSlug(slug)) return { status: "not-found" };
  const position = decodeReviewCursor(cursor);
  if (position === undefined) return { status: "invalid" };
  try {
    return await publicCoachReviewPageRecord(slug, position);
  } catch {
    return { status: "unavailable" };
  }
}
export async function publicCoachReviewSummaries(
  slugs: readonly string[],
): Promise<
  | Readonly<{ status: "ready"; summaries: ReadonlyMap<string, ReviewSummary> }>
  | Readonly<{ status: "invalid" | "unavailable" }>
> {
  if (slugs.length > 256 || slugs.some((slug) => !isCoachPublicSlug(slug)))
    return { status: "invalid" };
  try {
    return {
      status: "ready",
      summaries: await publicCoachReviewSummaryRecords([...new Set(slugs)]),
    };
  } catch {
    return { status: "unavailable" };
  }
}
