import { coachMediaVideoAccess } from "@/server/coaches/media-service";
import { mediaResponse, mediaHeaders } from "@/app/api/coach/media/transport";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string; kind: string }> },
) {
  const { slug, id, kind } = await context.params;
  if (kind !== "poster" && kind !== "playback")
    return mediaResponse({ status: "not-found" });
  const result = await coachMediaVideoAccess(slug, id, kind === "poster");
  return result.status === "ready" && result.url
    ? new Response(null, {
        status: 302,
        headers: { ...mediaHeaders, location: result.url },
      })
    : mediaResponse(result);
}
