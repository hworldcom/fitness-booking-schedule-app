import { calendarUuid } from "@/calendar/connection";
import {
  calendarBody,
  calendarResponse,
  calendarRedirect,
  calendarSameOrigin,
} from "@/server/google-calendar/http";
import { calendarRuntime } from "@/server/google-calendar/runtime";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!calendarSameOrigin(request, true))
    return calendarResponse({ status: "forbidden" });
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(
      await calendarBody(request, "application/x-www-form-urlencoded"),
    );
    if (
      [...form.keys()].some((k) => k !== "generation") ||
      form.getAll("generation").length !== 1 ||
      !calendarUuid(form.get("generation"))
    )
      return calendarResponse({ status: "invalid" });
  } catch {
    return calendarResponse({ status: "invalid" });
  }
  return calendarRedirect(
    await calendarRuntime().start(form.get("generation")!),
  );
}
