import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { reserveMemberClass } from "@/server/reservations/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<string, number> = {
  reserved: 200,
  existing: 200,
  "invalid-request": 400,
  "no-active-membership": 409,
  "class-unavailable": 409,
  "daily-conflict": 409,
  "allowance-exhausted": 409,
  full: 409,
  "state-conflict": 409,
  "operation-conflict": 409,
  "signed-out": 401,
  forbidden: 403,
  preview: 503,
  unavailable: 503,
};

function response(result: Awaited<ReturnType<typeof reserveMemberClass>>) {
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
    body.length > 1_024 ||
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
      Object.keys(record).length !== 2 ||
      !("operationId" in record) ||
      !("classSessionId" in record)
    ) {
      return response({ status: "invalid-request" });
    }
    return response(
      await reserveMemberClass({
        operationId: record.operationId,
        classSessionId: record.classSessionId,
      }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
