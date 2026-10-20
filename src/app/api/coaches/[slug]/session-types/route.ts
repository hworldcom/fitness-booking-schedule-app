import {
  publicSessionCatalog,
  publicSessionTimes,
  publicSessionWeek,
} from "@/server/coaches/typed-session-service";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const q = new URL(request.url).searchParams;
  let result: unknown;
  try {
    result = q.has("weekOf")
      ? q.has("date") || q.getAll("weekOf").length !== 1
        ? { status: "invalid" }
        : await publicSessionWeek(
            slug,
            q.get("typeId") ?? "",
            q.get("locationId") ?? "",
            q.get("weekOf") ?? "",
          )
      : q.has("typeId")
        ? await publicSessionTimes(
            slug,
            q.get("typeId") ?? "",
            q.get("locationId") ?? "",
            q.get("date") ?? "",
          )
        : { status: "ready", catalog: await publicSessionCatalog(slug) };
  } catch {
    result = { status: "unavailable" };
  }
  const status = (result as { status: string }).status;
  return Response.json(result, {
    status:
      status === "ready"
        ? 200
        : status === "invalid"
          ? 400
          : status === "signed-out"
            ? 401
            : status === "forbidden"
              ? 403
              : 503,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
