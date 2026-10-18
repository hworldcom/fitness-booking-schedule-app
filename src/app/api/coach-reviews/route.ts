import {
  commandCoachReview,
  currentCoachReview,
} from "@/server/coaches/review-service";
import {
  coachReviewRequest,
  coachReviewResponse,
} from "@/server/http/coach-reviews";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (
    [...query.keys()].some((key) => key !== "coach") ||
    query.getAll("coach").length !== 1
  )
    return coachReviewResponse({ status: "invalid" });
  return coachReviewResponse(await currentCoachReview(query.get("coach")!));
}
export async function POST(request: Request) {
  return coachReviewResponse(
    await commandCoachReview(await coachReviewRequest(request)),
  );
}
