import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { sponsorMembershipActivation } from "@/server/membership/service";

export const dynamic = "force-dynamic";

const statusCode: Record<string, number> = {
  ready: 200,
  "invalid-request": 400,
  "operation-conflict": 409,
  "state-conflict": 409,
  "account-unavailable": 409,
  "insufficient-eurc": 409,
  "destination-mismatch": 409,
  "simulation-failed": 409,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
  preview: 503,
  "configuration-unavailable": 503,
};

function response(
  result: Awaited<ReturnType<typeof sponsorMembershipActivation>>,
) {
  return NextResponse.json(result, {
    status: statusCode[result.status] ?? 500,
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
    body.length > 256 ||
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
    if (Object.keys(record).length !== 1 || !("operationId" in record)) {
      return response({ status: "invalid-request" });
    }
    return response(
      await sponsorMembershipActivation({ operationId: record.operationId }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
