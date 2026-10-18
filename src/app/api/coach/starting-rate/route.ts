import { revalidatePath } from "next/cache";
import {
  currentCoachStartingRate,
  saveCoachStartingRate,
} from "@/server/coaches/starting-rate-service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";
import { startingRateResponse } from "./_http";

export const dynamic = "force-dynamic";
export async function GET() {
  return startingRateResponse(await currentCoachStartingRate());
}
export async function PUT(request: Request) {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return startingRateResponse({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 2048);
  if (!bytes) return startingRateResponse({ status: "invalid" });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return startingRateResponse({ status: "invalid" });
  }
  const result = await saveCoachStartingRate(input);
  if (result.status === "saved") {
    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/coaches/[slug]", "page");
    revalidatePath("/[handle]", "page");
  }
  return startingRateResponse(result);
}
