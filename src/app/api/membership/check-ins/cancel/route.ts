import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { cancelMemberArrival } from "@/server/checkins/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<string, number> = {
  cancelled: 200,
  existing: 200,
  expired: 409,
  confirmed: 409,
  "invalid-request": 400,
  "not-found": 404,
  "signed-out": 401,
  forbidden: 403,
  preview: 503,
  unavailable: 503,
};

function response(result: Awaited<ReturnType<typeof cancelMemberArrival>>) {
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
    if (Object.keys(record).length !== 1 || !("requestId" in record)) {
      return response({ status: "invalid-request" });
    }
    return response(await cancelMemberArrival({ requestId: record.requestId }));
  } catch {
    return response({ status: "invalid-request" });
  }
}
