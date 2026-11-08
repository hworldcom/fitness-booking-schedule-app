import { currentConnectionPendingCount } from "@/server/connections/service";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const roles = query.getAll("role");
  const result = await currentConnectionPendingCount(
    roles.length === 1 ? roles[0] : null,
    request.headers.get("X-MovX-Connection-Owner"),
  );
  return Response.json(result, {
    status:
      result.status === "ready"
        ? 200
        : result.status === "invalid"
          ? 400
          : result.status === "signed-out"
            ? 401
            : result.status === "forbidden" || result.status === "preview"
              ? 403
              : result.status === "conflict"
                ? 409
                : 503,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, X-MovX-Connection-Owner",
    },
  });
}
