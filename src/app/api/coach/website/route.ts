import {
  currentCoachWebsite,
  saveCoachWebsite,
} from "@/server/coaches/website-service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin, websiteResponse } from "./_http";

export const dynamic = "force-dynamic";
export async function GET() {
  return websiteResponse(await currentCoachWebsite());
}
export async function PUT(request: Request) {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return websiteResponse({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 64 * 1024);
  if (!bytes) return websiteResponse({ status: "invalid" });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return websiteResponse({ status: "invalid" });
  }
  return websiteResponse(await saveCoachWebsite(input));
}
