import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import type { AuthenticationResult } from "@/auth/gateway";
import { parseAuthenticationCommand } from "@/auth/operations";
import { runAuthenticationCommand } from "@/server/auth/supabase-operations";

export const dynamic = "force-dynamic";

function response(result: AuthenticationResult) {
  const codes: Record<AuthenticationResult["status"], number> = {
    success: 200,
    requested: 200,
    "password-updated": 200,
    "recovery-required": 200,
    invalid: 400,
    "invalid-credentials": 401,
    "invalid-proof": 400,
    forbidden: 403,
    unavailable: 503,
    "rate-limited": 429,
  };
  return NextResponse.json(result, {
    status: codes[result.status],
    headers: {
      "cache-control": "private, no-store",
      vary: "Cookie",
      "referrer-policy": "no-referrer",
      ...(result.status === "rate-limited" && result.retryAfterSeconds !== null
        ? { "retry-after": String(result.retryAfterSeconds) }
        : {}),
    },
  });
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config) return response({ status: "unavailable" });
  if (request.headers.get("origin") !== config.siteUrl)
    return response({ status: "forbidden" });
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return response({ status: "invalid", message: "input" });
  const reader = request.body?.getReader();
  if (!reader) return response({ status: "invalid", message: "input" });
  let input: unknown;
  try {
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        return response({ status: "invalid", message: "input" });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return response({ status: "invalid", message: "input" });
  } finally {
    reader.releaseLock();
  }
  const command = parseAuthenticationCommand(input);
  return response(
    command
      ? await runAuthenticationCommand(command)
      : { status: "invalid", message: "input" },
  );
}
