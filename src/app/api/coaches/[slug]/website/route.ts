import { publicCoachWebsite } from "@/server/coaches/website-service";
import { websiteResponse } from "@/app/api/coach/website/_http";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return websiteResponse(await publicCoachWebsite(slug));
}
