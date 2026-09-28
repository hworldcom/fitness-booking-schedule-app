import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { confirmMemberArrival } from "@/server/checkins/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<string, number> = {
  confirmed: 200,
  existing: 200,
  "invalid-request": 400,
  "not-found": 404,
  forbidden: 403,
  cancelled: 409,
  expired: 409,
  "membership-inactive": 409,
  "claim-unavailable": 409,
  "allowance-exhausted": 409,
  "too-early": 409,
  "reservation-unavailable": 409,
  "signed-out": 401,
  preview: 503,
  unavailable: 503,
};

function response(result: Awaited<ReturnType<typeof confirmMemberArrival>>) {
  return NextResponse.json(result, {
    status: responseStatus[result.status] ?? 500,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return response({ status: "forbidden" });
  }
  const body = await request.text();
  if (
    body.length === 0 ||
    body.length > 512 ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return response({ status: "invalid-request" });
  }
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return response({ status: "invalid-request" });
    }
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !("presentationCode" in record)) {
      return response({ status: "invalid-request" });
    }
    return response(
      await confirmMemberArrival({
        presentationCode: record.presentationCode,
      }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
