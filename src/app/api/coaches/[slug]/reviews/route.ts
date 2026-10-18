import { publicCoachReviews } from "@/server/coaches/review-service";
import { coachReviewResponse } from "@/server/http/coach-reviews";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const query = new URL(request.url).searchParams;
  if (
    [...query.keys()].some((key) => key !== "cursor") ||
    query.getAll("cursor").length > 1
  )
    return coachReviewResponse({ status: "invalid" });
  return coachReviewResponse(
    await publicCoachReviews((await params).slug, query.get("cursor")),
  );
}
