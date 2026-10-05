import "server-only";

import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import type { GroupEventOperationApiResult } from "@/solana/group-event-operation";

const responseStatus: Record<GroupEventOperationApiResult["status"], number> = {
  preview: 200,
  prepared: 200,
  submitted: 200,
  finalized: 200,
  failed: 200,
  expired: 200,
  "signed-out": 401,
  forbidden: 403,
  "invalid-request": 400,
  conflict: 409,
  unavailable: 503,
};

export function hasGroupEventCanonicalOrigin(request: Request) {
  const config = supabasePublicConfig();
  return config !== null && request.headers.get("origin") === config.siteUrl;
}

export function groupEventResponse(value: GroupEventOperationApiResult) {
  return NextResponse.json(value, {
    status: responseStatus[value.status],
    headers: { "cache-control": "private, no-store" },
  });
}

export async function groupEventRequestJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
