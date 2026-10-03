import { NextResponse } from "next/server";
import { verifiedAuthSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifiedAuthSession();
  return NextResponse.json(session, {
    status: session.status === "unavailable" ? 503 : 200,
    headers: { "cache-control": "private, no-store" },
  });
}
