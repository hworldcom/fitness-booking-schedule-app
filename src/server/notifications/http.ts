import "server-only";
import {
  NOTIFICATION_VERSION_HEADER,
  type NotificationResult,
} from "@/notifications/contracts";

export function notificationHandlers(
  command: (input: unknown, version: 1 | 2) => Promise<NotificationResult>,
  siteUrl: () => string | undefined,
) {
  function response(result: NotificationResult) {
    const status = {
      ready: 200,
      invalid: 400,
      conflict: 409,
      "signed-out": 401,
      forbidden: 403,
      preview: 403,
      unavailable: 503,
    }[result.status];
    return Response.json(result, {
      status,
      headers: { "cache-control": "private, no-store", vary: "Cookie" },
    });
  }
  return {
    async GET(request: Request) {
      const version = request.headers.get(NOTIFICATION_VERSION_HEADER) ?? "1";
      if (version !== "1" && version !== "2")
        return response({ status: "invalid" });
      const params = new URL(request.url).searchParams;
      if (
        [...params.keys()].some(
          (k) => !["filter", "beforeAt", "beforeId"].includes(k),
        ) ||
        [...params.keys()].some((k) => params.getAll(k).length !== 1)
      )
        return response({ status: "invalid" });
      return response(
        await command(
          { action: "list", args: Object.fromEntries(params) },
          version === "2" ? 2 : 1,
        ),
      );
    },
    async POST(request: Request) {
      const version = request.headers.get(NOTIFICATION_VERSION_HEADER) ?? "1";
      if (version !== "1" && version !== "2")
        return response({ status: "invalid" });
      const origin = siteUrl();
      if (!origin || request.headers.get("origin") !== origin)
        return response({ status: "forbidden" });
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        return response({ status: "invalid" });
      const reader = request.body?.getReader();
      if (!reader) return response({ status: "invalid" });
      let input: unknown;
      try {
        const chunks: Uint8Array[] = [];
        let length = 0;
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
        input = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch {
        return response({ status: "invalid" });
      } finally {
        reader.releaseLock();
      }
      if (
        !input ||
        typeof input !== "object" ||
        !["read", "read-all"].includes(
          String((input as { action?: unknown }).action),
        )
      )
        return response({ status: "invalid" });
      return response(await command(input, version === "2" ? 2 : 1));
    },
  };
}
