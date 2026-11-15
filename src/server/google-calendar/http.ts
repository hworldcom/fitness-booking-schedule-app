import "server-only";
import { NextResponse } from "next/server";
import { calendarSiteUrl } from "./config";
import {
  CALENDAR_SETTINGS_PATH,
  type CalendarResult,
} from "@/calendar/connection";

export const calendarHeaders = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  vary: "Cookie",
};
export function calendarResponse(result: CalendarResult) {
  const code = {
    ready: 200,
    invalid: 400,
    "signed-out": 401,
    forbidden: 403,
    conflict: 409,
    unavailable: 503,
    "delete-uncertain": 503,
  };
  return NextResponse.json(result, {
    status: code[result.status],
    headers: calendarHeaders,
  });
}
export function calendarSameOrigin(request: Request, navigation = false) {
  const origin = calendarSiteUrl();
  return (
    !!origin &&
    (request.headers.get("origin") === origin ||
      (navigation &&
        request.headers.get("origin") === "null" &&
        request.headers.get("sec-fetch-site") === "same-origin"))
  );
}
export async function calendarBody(request: Request, contentType: string) {
  if (request.headers.get("content-type")?.split(";", 1)[0] !== contentType)
    throw Error("Invalid request");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Invalid request");
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "",
      size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        throw Error("Invalid request");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export function calendarRedirect(
  location = `${CALENDAR_SETTINGS_PATH}&calendar=unavailable`,
) {
  const origin = calendarSiteUrl();
  if (!origin)
    return new Response("Calendar connection unavailable.", {
      status: 503,
      headers: calendarHeaders,
    });
  const url = new URL(location, origin);
  url.hash = "#";
  return NextResponse.redirect(url, { status: 303, headers: calendarHeaders });
}
