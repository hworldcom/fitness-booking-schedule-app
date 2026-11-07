import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { parseAuthenticationCommand } from "@/auth/operations";
import { createGoogleAuthentication } from "@/server/auth/google";

export const dynamic = "force-dynamic";
const headers = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
};
export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config)
    return new Response("Sign-in unavailable. Please try again shortly.", {
      status: 503,
      headers,
    });
  const origin = request.headers.get("origin");
  // no-referrer documents send a null Origin for navigation POSTs. Fetch Metadata
  // is browser-controlled; never infer same-origin from an absent/foreign Origin.
  const sameOriginNavigation =
    origin === "null" &&
    request.headers.get("sec-fetch-site") === "same-origin";
  if (origin !== config.siteUrl && !sameOriginNavigation)
    return new Response("Forbidden", { status: 403, headers });
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !==
    "application/x-www-form-urlencoded"
  )
    return new Response("Invalid request", { status: 400, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Invalid request", { status: 400, headers });
  let text = "";
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return new Response("Invalid request", { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
  const params = new URLSearchParams(text);
  if (
    [...params.keys()].some(
      (key) =>
        !["returnTo", "intent"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return new Response("Invalid request", { status: 400, headers });
  const command = parseAuthenticationCommand({
    action: "start-google",
    ...Object.fromEntries(params),
  });
  if (!command || command.action !== "start-google")
    return new Response("Invalid request", { status: 400, headers });
  const location = await createGoogleAuthentication().start(command);
  return NextResponse.redirect(new URL(location, config.siteUrl), {
    status: 303,
    headers,
  });
}
