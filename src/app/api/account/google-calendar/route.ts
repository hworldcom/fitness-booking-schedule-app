import { calendarCommand } from "@/calendar/connection";
import {
  calendarBody,
  calendarResponse,
  calendarSameOrigin,
} from "@/server/google-calendar/http";
import {
  calendarRuntime,
  currentCalendarConnection,
} from "@/server/google-calendar/runtime";
import { CalendarServiceError } from "@/server/google-calendar/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  return calendarResponse(await currentCalendarConnection());
}
export async function POST(request: Request) {
  if (!calendarSameOrigin(request))
    return calendarResponse({ status: "forbidden" });
  let input;
  try {
    input = calendarCommand(
      JSON.parse(await calendarBody(request, "application/json")),
    );
  } catch {
    return calendarResponse({ status: "invalid" });
  }
  if (!input) return calendarResponse({ status: "invalid" });
  try {
    await calendarRuntime().run(input);
    return calendarResponse(await currentCalendarConnection());
  } catch (error) {
    return calendarResponse({
      status:
        error instanceof CalendarServiceError ? error.status : "unavailable",
    });
  }
}
