import { eventBannerBytes } from "@/server/group-sessions/banner-service";
import { bannerBytesResponse } from "@/app/api/coach/website/_http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; variant: string }> },
) {
  const { slug, variant } = await context.params;
  const revision = new URL(request.url).searchParams.get("v");
  if (
    (variant !== "card" && variant !== "hero") ||
    !revision ||
    !/^(0|[1-9]\d*)$/.test(revision)
  )
    return bannerBytesResponse({ status: "not-found" });
  return bannerBytesResponse(
    await eventBannerBytes(slug, variant, Number(revision), true),
  );
}
