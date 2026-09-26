import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { failMembershipActivation } from "@/server/membership/service";

export const dynamic = "force-dynamic";

function response(
  result: Awaited<ReturnType<typeof failMembershipActivation>>,
) {
  const status =
    result.status === "failed" || result.status === "existing"
      ? 200
      : result.status === "invalid-request"
        ? 400
        : result.status === "signed-out"
          ? 401
          : result.status === "forbidden"
            ? 403
            : result.status === "unavailable"
              ? 503
              : 409;
  return NextResponse.json(result, {
    status,
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
    if (
      Object.keys(record).length !== 2 ||
      record.reason !== "wallet-cancelled"
    ) {
      return response({ status: "invalid-request" });
    }
    return response(
      await failMembershipActivation({
        operationId: record.operationId,
        reason: record.reason,
      }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
