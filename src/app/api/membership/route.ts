import { NextResponse } from "next/server";
import { memberMembershipState } from "@/server/membership/service";

export const dynamic = "force-dynamic";

const responseStatus = {
  ready: 200,
  preview: 503,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
} as const;

export async function GET() {
  const result = await memberMembershipState();
  return NextResponse.json(result, {
    status: responseStatus[result.status],
    headers: { "cache-control": "private, no-store" },
  });
}
