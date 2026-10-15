import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { currentMessageCommand } from "@/server/messages/service";
export const dynamic = "force-dynamic";
function response(result: Awaited<ReturnType<typeof currentMessageCommand>>) {
  const status =
    result.status === "ready"
      ? 200
      : result.status === "signed-out"
        ? 401
        : ["forbidden", "preview"].includes(result.status)
          ? 403
          : result.status === "invalid"
            ? 400
            : result.status === "rate-limited"
              ? 429
              : result.status === "conflict"
                ? 409
                : 503;
  return NextResponse.json(result, {
    status,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const args: Record<string, unknown> = {};
  for (const k of [
    "conversationId",
    "coachId",
    "filter",
    "beforeAt",
    "beforeId",
  ])
    if (p.has(k)) args[k] = p.get(k);
  for (const k of ["after", "before"]) if (p.has(k)) args[k] = Number(p.get(k));
  const action = p.has("conversationId")
    ? "thread"
    : p.has("coachId")
      ? "contact"
      : "inbox";
  return response(await currentMessageCommand({ action, args }));
}
export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl)
    return response({ status: "forbidden" });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
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
      if (length > 32768) {
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
  return response(await currentMessageCommand(input));
}
