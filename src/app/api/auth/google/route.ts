import { NextResponse } from "next/server";
import { googleProviderAvailable } from "@/server/auth/google";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { available: await googleProviderAvailable() },
    {
      headers: {
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
      },
    },
  );
}
