import { NextResponse } from "next/server";
import type { AccountResult } from "@/account/contracts";
import { supabasePublicConfig } from "@/auth/config";
import {
  currentAccountDetails,
  saveCurrentAccountDetails,
} from "@/server/account/service";

export const dynamic = "force-dynamic";

function response(result: AccountResult) {
  const codes = {
    ready: 200,
    invalid: 400,
    conflict: 409,
    "signed-out": 401,
    forbidden: 403,
    unavailable: 503,
  };
  return NextResponse.json(result, {
    status: codes[result.status],
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}

export async function GET() {
  return response(await currentAccountDetails());
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl)
    return response({ status: "forbidden" });
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return response({ status: "invalid" });
  const reader = request.body?.getReader();
  if (!reader) return response({ status: "invalid" });
  let input: unknown;
  try {
    let length = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2048) {
        await reader.cancel();
        return response({ status: "invalid" });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return response({ status: "invalid" });
  } finally {
    reader.releaseLock();
  }
  return response(await saveCurrentAccountDetails(input));
}
