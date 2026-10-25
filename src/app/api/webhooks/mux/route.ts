import { boundedRequestBody } from "@/server/http/bounded-body";
import { verifyMuxSignature } from "@/server/coaches/mux-video";
import { processCoachMediaWebhook } from "@/server/coaches/media-service";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !process.env.COACH_MEDIA_DATABASE_URL)
    return new Response(null, { status: 503 });
  const bytes = await boundedRequestBody(request, 256 * 1024);
  if (!bytes) return new Response(null, { status: 400 });
  const body = new TextDecoder().decode(bytes);
  if (!verifyMuxSignature(body, request.headers.get("mux-signature"), secret))
    return new Response(null, { status: 401 });
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    await processCoachMediaWebhook(event);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
