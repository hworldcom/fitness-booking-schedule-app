import "server-only";
import { createHash } from "node:crypto";

export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";
export type CalendarConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  siteUrl: string;
  callbackUrl: string;
  clientHash: string;
  calendarName: string;
  keys: readonly Buffer[];
}>;
export function calendarSiteUrl(
  value = process.env.NEXT_PUBLIC_SITE_URL,
): string | null {
  try {
    const origin = new URL(value!);
    return !origin.username &&
      !origin.password &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash &&
      (origin.protocol === "https:" ||
        (origin.protocol === "http:" && origin.hostname === "localhost"))
      ? origin.origin
      : null;
  } catch {
    return null;
  }
}
export function parseCalendarConfig(
  env: Record<string, string | undefined>,
): CalendarConfig | null {
  if (env.MOVX_GOOGLE_CALENDAR_ENABLED !== "true") return null;
  try {
    const siteUrl = calendarSiteUrl(env.NEXT_PUBLIC_SITE_URL);
    if (!siteUrl) return null;
    const origin = new URL(siteUrl);
    const clientId = env.MOVX_GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? "";
    const clientSecret = env.MOVX_GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? "";
    if (
      !/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId) ||
      clientSecret.length < 10
    )
      return null;
    const encoded = [
      env.MOVX_GOOGLE_CALENDAR_TOKEN_KEY ?? "",
      ...(env.MOVX_GOOGLE_CALENDAR_PREVIOUS_TOKEN_KEYS?.split(",") ?? []),
    ];
    if (
      encoded.length > 4 ||
      encoded.some((k) => !/^[A-Za-z0-9+/]{43}=$/.test(k.trim()))
    )
      return null;
    const keys = encoded.map((k) => Buffer.from(k.trim(), "base64"));
    if (keys.some((k) => k.length !== 32)) return null;
    return {
      clientId,
      clientSecret,
      siteUrl: origin.origin,
      callbackUrl: new URL("/auth/google-calendar/callback", origin).toString(),
      clientHash: createHash("sha256").update(clientId).digest("hex"),
      calendarName:
        origin.hostname === "localhost"
          ? "MovX (Local)"
          : origin.origin === "https://uat.movx.club"
            ? "MovX (UAT)"
            : origin.origin === "https://movx.club"
              ? "MovX"
              : "MovX (Test)",
      keys,
    };
  } catch {
    return null;
  }
}
export function calendarConfig() {
  return parseCalendarConfig(process.env);
}
