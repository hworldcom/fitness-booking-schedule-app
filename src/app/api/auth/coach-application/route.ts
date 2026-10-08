import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import type { CoachApplicationSubmissionSnapshot } from "@/auth/coach-application-contracts";
import { submitCurrentCoachApplication } from "@/server/coaches/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<
  CoachApplicationSubmissionSnapshot["status"],
  number
> = {
  pending: 200,
  approved: 200,
  rejected: 200,
  suspended: 409,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
};

function applicationResponse(
  status: CoachApplicationSubmissionSnapshot["status"],
) {
  return NextResponse.json(
    { status } satisfies CoachApplicationSubmissionSnapshot,
    {
      status: responseStatus[status],
      headers: { "cache-control": "private, no-store" },
    },
  );
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return applicationResponse("unavailable");
  }

  const result = await submitCurrentCoachApplication();
  if (
    result.status === "pending" ||
    result.status === "approved" ||
    result.status === "rejected" ||
    result.status === "suspended"
  ) {
    return applicationResponse(result.status);
  }
  if (result.status === "signed-out") return applicationResponse("signed-out");
  if (result.status === "forbidden" || result.status === "preview") {
    return applicationResponse("forbidden");
  }
  return applicationResponse("unavailable");
}
