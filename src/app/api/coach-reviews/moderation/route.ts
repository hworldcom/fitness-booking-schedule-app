import { commandCoachReview } from "@/server/coaches/review-service";
import {
  coachReviewRequest,
  coachReviewResponse,
} from "@/server/http/coach-reviews";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return coachReviewResponse(
    await commandCoachReview(await coachReviewRequest(request), true),
  );
}
