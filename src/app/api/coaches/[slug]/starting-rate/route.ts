import { publicCoachStartingRate } from "@/server/coaches/starting-rate-service";
import { startingRateResponse } from "@/app/api/coach/starting-rate/_http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return startingRateResponse(await publicCoachStartingRate(slug));
}
