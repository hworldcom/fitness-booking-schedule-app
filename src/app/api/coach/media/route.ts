import {
  currentCoachMedia,
  commandCoachMedia,
  uploadCoachMediaPhoto,
} from "@/server/coaches/media-service";
import { COACH_MEDIA_PHOTO_BYTES } from "@/domain/coach-media";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { bannerExpectedRevision, sameWebsiteOrigin } from "../website/_http";
import { mediaResponse } from "./transport";
export const dynamic = "force-dynamic";
export async function GET() {
  return mediaResponse(await currentCoachMedia());
}
export async function POST(request: Request) {
  if (!sameWebsiteOrigin(request))
    return mediaResponse({ status: "forbidden" });
  const type = request.headers.get("content-type")?.split(";", 1)[0];
  if (["image/jpeg", "image/png", "image/webp"].includes(type ?? "")) {
    const bytes = await boundedRequestBody(request, COACH_MEDIA_PHOTO_BYTES);
    if (!bytes) return mediaResponse({ status: "invalid" });
    let description: string;
    try {
      description = decodeURIComponent(
        request.headers.get("x-media-description") ?? "",
      );
    } catch {
      return mediaResponse({ status: "invalid" });
    }
    return mediaResponse(
      await uploadCoachMediaPhoto(
        bytes,
        bannerExpectedRevision(request),
        request.headers.get("x-media-id") ?? "",
        description,
        request.headers.get("x-replace-id"),
      ),
    );
  }
  if (type !== "application/json") return mediaResponse({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 8192);
  if (!bytes) return mediaResponse({ status: "invalid" });
  let command: unknown;
  try {
    command = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    return mediaResponse({ status: "invalid" });
  }
  return mediaResponse(
    await commandCoachMedia(
      command,
      request.headers.get("origin") ?? undefined,
    ),
  );
}
