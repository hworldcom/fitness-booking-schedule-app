import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import type { CoachingActivationSnapshot } from "@/auth/coaching-activation-contracts";
import { activateCurrentCoaching } from "@/server/coaches/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<CoachingActivationSnapshot["status"], number> = {
  activated: 200,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
};

function activationResponse(status: CoachingActivationSnapshot["status"]) {
  return NextResponse.json({ status } satisfies CoachingActivationSnapshot, {
    status: responseStatus[status],
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return activationResponse("unavailable");
  }

  const result = await activateCurrentCoaching();
  if (result.status === "activated") return activationResponse("activated");
  if (result.status === "signed-out") return activationResponse("signed-out");
  if (result.status === "forbidden" || result.status === "preview") {
    return activationResponse("forbidden");
  }
  return activationResponse("unavailable");
}
