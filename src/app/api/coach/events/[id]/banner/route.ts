import {
  COACH_BANNER_MAX_SOURCE_BYTES,
  isWebsiteRevision,
} from "@/domain/coach-website";
import { isEventId } from "@/domain/event-banners";
import { boundedRequestBody } from "@/server/http/bounded-body";
import {
  currentEventBanner,
  uploadEventBanner,
  removeEventBanner,
} from "@/server/group-sessions/banner-service";
import {
  sameWebsiteOrigin,
  bannerExpectedRevision,
} from "@/app/api/coach/website/_http";
import { eventBannerResponse } from "@/app/api/coach/events/_http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return eventBannerResponse(await currentEventBanner(id));
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const revision = bannerExpectedRevision(request);
  if (
    !isEventId(id) ||
    !sameWebsiteOrigin(request) ||
    !isWebsiteRevision(revision) ||
    !["image/jpeg", "image/png", "image/webp"].includes(
      request.headers.get("content-type")?.split(";", 1)[0] ?? "",
    )
  )
    return eventBannerResponse({ status: "invalid" });
  const bytes = await boundedRequestBody(
    request,
    COACH_BANNER_MAX_SOURCE_BYTES,
  );
  return eventBannerResponse(
    bytes
      ? await uploadEventBanner(id, bytes, revision)
      : { status: "invalid" },
  );
}
export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const revision = bannerExpectedRevision(request);
  if (
    !isEventId(id) ||
    !sameWebsiteOrigin(request) ||
    !isWebsiteRevision(revision)
  )
    return eventBannerResponse({ status: "invalid" });
  return eventBannerResponse(await removeEventBanner(id, revision));
}
