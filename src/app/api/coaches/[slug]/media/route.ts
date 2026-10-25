import { currentPublicCoachMedia } from "@/server/coaches/media-service";
import { mediaResponse } from "@/app/api/coach/media/transport";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return mediaResponse(
    await currentPublicCoachMedia((await context.params).slug),
  );
}
