import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { createGoogleAuthentication } from "@/server/auth/google";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = supabasePublicConfig();
  const headers = {
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  };
  if (!config)
    return new Response("Sign-in unavailable. Please try again shortly.", {
      status: 503,
      headers,
    });
  const next = await createGoogleAuthentication().callback(
    new URL(request.url).searchParams,
  );
  // Remove the code before application HTML; prevent inherited provider fragments.
  const location = new URL(next, config.siteUrl);
  location.hash = "#";
  return NextResponse.redirect(location, { status: 303, headers });
}
