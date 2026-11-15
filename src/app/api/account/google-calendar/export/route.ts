import {
  calendarExportCommand,
  type CalendarExportResult,
} from "@/calendar/export";
import {
  calendarBody,
  calendarSameOrigin,
} from "@/server/google-calendar/http";
import {
  currentCalendarExport,
  changeCalendarExport,
} from "@/server/google-calendar/export-runtime";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
function response(value: CalendarExportResult) {
  const status =
    value.status === "ready"
      ? 200
      : value.status === "signed-out"
        ? 401
        : value.status === "forbidden"
          ? 403
          : value.status === "invalid"
            ? 400
            : value.status === "conflict" ||
                value.status === "connection-required"
              ? 409
              : 503;
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      vary: "Cookie",
    },
  });
}
export async function GET(request: Request) {
  try {
    return response(await currentCalendarExport(new URL(request.url).origin));
  } catch {
    return response({ status: "unavailable" });
  }
}
export async function POST(request: Request) {
  if (!calendarSameOrigin(request)) return response({ status: "forbidden" });
  let input;
  try {
    input = calendarExportCommand(
      JSON.parse(await calendarBody(request, "application/json")),
    );
  } catch {
    return response({ status: "invalid" });
  }
  if (!input) return response({ status: "invalid" });
  try {
    return response(
      await changeCalendarExport(input, new URL(request.url).origin),
    );
  } catch {
    return response({ status: "unavailable" });
  }
}
