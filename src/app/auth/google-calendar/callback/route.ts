import { calendarRedirect } from "@/server/google-calendar/http";
import { calendarRuntime } from "@/server/google-calendar/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    return calendarRedirect(
      await calendarRuntime().callback(new URL(request.url).searchParams),
    );
  } catch {
    return calendarRedirect();
  }
}
