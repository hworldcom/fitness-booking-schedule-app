import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import {
  createMemberArrival,
  memberCheckinSnapshot,
} from "@/server/checkins/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<string, number> = {
  ready: 200,
  created: 200,
  existing: 200,
  "invalid-request": 400,
  "no-active-membership": 409,
  "venue-unavailable": 409,
  "reservation-unavailable": 409,
  "too-early": 409,
  "too-late": 409,
  "daily-conflict": 409,
  "allowance-exhausted": 409,
  "pending-conflict": 409,
  "operation-conflict": 409,
  "signed-out": 401,
  forbidden: 403,
  preview: 503,
  unavailable: 503,
};

function response(result: object & { status: string }) {
  return NextResponse.json(result, {
    status: responseStatus[result.status] ?? 500,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  return response(await memberCheckinSnapshot());
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
      Object.keys(record).length !== 3 ||
      !("operationId" in record) ||
      !("venueId" in record) ||
      !("reservationId" in record)
    ) {
      return response({ status: "invalid-request" });
    }
    return response(
      await createMemberArrival({
        operationId: record.operationId,
        venueId: record.venueId,
        reservationId: record.reservationId,
      }),
    );
  } catch {
    return response({ status: "invalid-request" });
  }
}
