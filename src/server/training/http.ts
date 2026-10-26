import "server-only";
import type { trainingCommand } from "./service";
export function trainingHandler(
  command: typeof trainingCommand,
  siteUrl: () => string | undefined,
) {
  return async function POST(request: Request) {
    const headers = { "cache-control": "private, no-store", vary: "Cookie" };
    const origin = siteUrl();
    if (!origin || request.headers.get("origin") !== origin)
      return Response.json({ status: "forbidden" }, { status: 403, headers });
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return Response.json({ status: "invalid" }, { status: 400, headers });
    let body: { command: unknown; scope: string };
    try {
      const reader = request.body?.getReader();
      if (!reader) throw Error("Missing body");
      let text = "",
        size = 0;
      const decoder = new TextDecoder("utf-8", { fatal: true });
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 12000) {
            await reader.cancel();
            throw Error("Too large");
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      body = JSON.parse(text);
      if (
        !body ||
        typeof body !== "object" ||
        Object.keys(body).some((k) => !["command", "scope"].includes(k)) ||
        typeof body.scope !== "string" ||
        body.scope.length > 200
      )
        throw Error("Invalid envelope");
    } catch {
      return Response.json({ status: "invalid" }, { status: 400, headers });
    }
    try {
      const result = await command(body.command, body.scope);
      const status = {
        ready: 200,
        invalid: 400,
        conflict: 409,
        "actor-changed": 403,
        "signed-out": 401,
        forbidden: 403,
        preview: 403,
        unavailable: 503,
      }[result.status];
      return Response.json(result, { status, headers });
    } catch {
      return Response.json({ status: "unavailable" }, { status: 503, headers });
    }
  };
}
