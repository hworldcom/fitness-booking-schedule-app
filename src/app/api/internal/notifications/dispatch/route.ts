import { timingSafeEqual } from "node:crypto";
import { runNotificationWorker } from "@/server/notifications/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const headers = { "cache-control": "no-store" };
  if (!secret || secret.length < 32)
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ status: "unauthorized" }, { status: 401, headers });
  try {
    return Response.json(
      { status: "ready", result: await runNotificationWorker(process.env, 5) },
      { headers },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
