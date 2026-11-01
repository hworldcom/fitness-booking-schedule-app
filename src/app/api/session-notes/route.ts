import { sessionNotesCommand } from "@/server/notes/service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const respond = (result: { status: string }) =>
    Response.json(result, {
      status:
        (
          {
            ready: 200,
            saved: 200,
            conflict: 409,
            invalid: 400,
            limit: 409,
            forbidden: 403,
            "actor-changed": 403,
            "signed-out": 401,
          } as Record<string, number>
        )[result.status] ?? 503,
      headers: { "cache-control": "private, no-store", vary: "Cookie" },
    });
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return respond({ status: "forbidden" });
  const bytes = await boundedRequestBody(request, 65536);
  if (!bytes) return respond({ status: "invalid" });
  let body: { command: unknown; scope: string };
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (
      !body ||
      Object.keys(body).some((k) => !["command", "scope"].includes(k)) ||
      typeof body.scope !== "string"
    )
      throw Error("Invalid input");
  } catch {
    return respond({ status: "invalid" });
  }
  return respond(await sessionNotesCommand(body.command, body.scope));
}
