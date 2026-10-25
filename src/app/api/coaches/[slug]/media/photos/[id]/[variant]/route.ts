import { coachMediaPhotoBytes } from "@/server/coaches/media-service";
import { mediaBytesResponse } from "@/app/api/coach/media/transport";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string; variant: string }> },
) {
  const { slug, id, variant } = await context.params;
  if (variant !== "thumbnail" && variant !== "full")
    return mediaBytesResponse({ status: "not-found" });
  return mediaBytesResponse(await coachMediaPhotoBytes(slug, id, variant));
}
