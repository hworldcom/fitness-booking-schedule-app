import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { prepareMembershipActivation } from "@/server/membership/service";

export const dynamic = "force-dynamic";

const statusCode: Record<string, number> = {
  prepared: 200,
  existing: 200,
  "invalid-request": 400,
  "invalid-selection": 400,
  "operation-conflict": 409,
  "state-conflict": 409,
  "wallet-conflict": 409,
  "payment-conflict": 409,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
  preview: 503,
  "configuration-unavailable": 503,
};

function response(
  result: Awaited<ReturnType<typeof prepareMembershipActivation>>,
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
    body.length > 2_048 ||
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
    if (
      Object.keys(record).length !== 3 ||
      !("operationId" in record) ||
      !("planId" in record) ||
      !("gymIds" in record)
    ) {
      return response({ status: "invalid-request" });
    }
    return response(
      await prepareMembershipActivation({
        operationId: record.operationId,
        planId: record.planId,
        gymIds: record.gymIds,
      }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
