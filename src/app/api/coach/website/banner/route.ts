import {
  COACH_BANNER_MAX_SOURCE_BYTES,
  isWebsiteRevision,
} from "@/domain/coach-website";
import { boundedRequestBody } from "@/server/http/bounded-body";
import {
  uploadCoachWebsiteBanner,
  removeCoachWebsiteBanner,
} from "@/server/coaches/website-service";
import {
  bannerExpectedRevision,
  sameWebsiteOrigin,
  websiteResponse,
} from "../_http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const revision = bannerExpectedRevision(request);
  if (
    !sameWebsiteOrigin(request) ||
    !isWebsiteRevision(revision) ||
    !["image/jpeg", "image/png", "image/webp"].includes(
      request.headers.get("content-type")?.split(";", 1)[0] ?? "",
    )
  )
    return websiteResponse({ status: "invalid" });
  const bytes = await boundedRequestBody(
    request,
    COACH_BANNER_MAX_SOURCE_BYTES,
  );
  if (!bytes) return websiteResponse({ status: "invalid" });
  return websiteResponse(await uploadCoachWebsiteBanner(bytes, revision));
}
export async function DELETE(request: Request) {
  const revision = bannerExpectedRevision(request);
  if (!sameWebsiteOrigin(request) || !isWebsiteRevision(revision))
    return websiteResponse({ status: "invalid" });
  return websiteResponse(await removeCoachWebsiteBanner(revision));
}
