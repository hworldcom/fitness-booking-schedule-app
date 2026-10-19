import { PROFILE_IMAGE_MIME_TYPE } from "@/profile-images/contracts";
import { currentOrPublicSharedCoachPicture } from "@/server/profile-images/shared-coach-picture";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  const query = new URL(request.url).searchParams;
  const version = query.get("v");
  const picture =
    query.size === 1 && version
      ? await currentOrPublicSharedCoachPicture(profileId, version)
      : { status: "not-found" as const };
  const headers = {
    "cache-control": "private, no-store",
    "content-type": PROFILE_IMAGE_MIME_TYPE,
    vary: "Cookie",
    "x-content-type-options": "nosniff",
  };
  return picture.status === "ready"
    ? new Response(picture.bytes, { headers })
    : new Response(null, {
        status: picture.status === "unavailable" ? 503 : 404,
        headers,
      });
}
