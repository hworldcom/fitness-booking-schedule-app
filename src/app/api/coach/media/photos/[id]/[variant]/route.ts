import { coachMediaPhotoBytes } from "@/server/coaches/media-service";
import { mediaBytesResponse } from "@/app/api/coach/media/transport";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; variant: string }> },
) {
  const { id, variant } = await context.params;
  if (variant !== "thumbnail" && variant !== "full")
    return mediaBytesResponse({ status: "not-found" });
  return mediaBytesResponse(await coachMediaPhotoBytes(null, id, variant));
}
