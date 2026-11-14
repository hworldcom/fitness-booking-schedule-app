import "server-only";
import { calendarId } from "@/calendar/connection";
import { CALENDAR_SCOPE, type CalendarConfig } from "./config";
import { challenge } from "./crypto";

export class CalendarProviderError extends Error {
  constructor(
    public readonly kind: "authorization" | "missing" | "unavailable",
    public readonly reason?: "calendar-permission-missing",
  ) {
    super("Google Calendar request could not be completed.");
  }
}
const allowedScopes = new Set([
  CALENDAR_SCOPE,
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);
export function googleCalendarProvider(
  config: CalendarConfig,
  transport: typeof fetch = fetch,
) {
  async function json(
    url: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await transport(url, {
        ...init,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        // Never include provider response bodies, tokens, URLs or proof in errors.
        throw new CalendarProviderError(
          response.status === 401 ||
            response.status === 403 ||
            response.status === 400
            ? "authorization"
            : response.status === 404 || response.status === 410
              ? "missing"
              : "unavailable",
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error();
      try {
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 65536) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(value);
        }
        const v: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!v || typeof v !== "object" || Array.isArray(v)) throw Error();
        return v as Record<string, unknown>;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof CalendarProviderError) throw error;
      throw new CalendarProviderError("unavailable");
    }
  }
  async function token(params: Record<string, string>, requireScope: boolean) {
    const result = await json("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...params,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (
      typeof result.scope === "string" &&
      result.scope.split(" ").some((scope) => !allowedScopes.has(scope))
    )
      throw new CalendarProviderError("authorization");
    if (
      result.token_type !== "Bearer" ||
      typeof result.access_token !== "string" ||
      result.access_token.length > 8192 ||
      !result.access_token ||
      (requireScope && typeof result.scope !== "string")
    )
      throw new CalendarProviderError("authorization");
    if (
      result.refresh_token !== undefined &&
      (typeof result.refresh_token !== "string" ||
        !result.refresh_token ||
        result.refresh_token.length > 4096)
    )
      throw new CalendarProviderError("authorization");
    if (
      requireScope &&
      typeof result.scope === "string" &&
      !result.scope.split(" ").includes(CALENDAR_SCOPE)
    )
      throw new CalendarProviderError(
        "authorization",
        "calendar-permission-missing",
      );
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token as string | undefined,
    };
  }
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  return {
    authorize(state: string, verifier: string) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl,
        response_type: "code",
        scope: `openid email ${CALENDAR_SCOPE}`,
        access_type: "offline",
        prompt: "consent select_account",
        state,
        code_challenge: challenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },
    exchange: (code: string, verifier: string) =>
      token(
        {
          grant_type: "authorization_code",
          code,
          redirect_uri: config.callbackUrl,
          code_verifier: verifier,
        },
        true,
      ),
    refresh: (refreshToken: string) =>
      token(
        { grant_type: "refresh_token", refresh_token: refreshToken },
        false,
      ),
    async identity(accessToken: string) {
      const v = await json("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: headers(accessToken),
      });
      if (
        typeof v.sub !== "string" ||
        !/^[A-Za-z0-9_-]{1,255}$/.test(v.sub) ||
        v.email_verified !== true ||
        typeof v.email !== "string" ||
        v.email.length > 320 ||
        !/^[^\s@]+@[^\s@]+$/.test(v.email)
      )
        throw new CalendarProviderError("authorization");
      return { sub: v.sub, email: v.email.toLowerCase() };
    },
    async calendar(
      accessToken: string,
      id: string,
      checkpoint: () => Promise<void>,
    ) {
      if (!calendarId(id)) throw new CalendarProviderError("missing");
      const v = await json(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}?fields=id`,
        { headers: headers(accessToken) },
      );
      if (v.id !== id) throw new CalendarProviderError("missing");
      // Prove access to this app-created calendar's event collection without
      // retrieving event data. Calendar metadata alone is not event authority.
      await checkpoint();
      const events = await json(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?maxResults=1&fields=kind`,
        { headers: headers(accessToken) },
      );
      if (events.kind !== "calendar#events")
        throw new CalendarProviderError("missing");
      return id;
    },
    async createCalendar(accessToken: string) {
      const v = await json("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        headers: {
          ...headers(accessToken),
          "content-type": "application/json",
        },
        body: JSON.stringify({ summary: "MovX", timeZone: "Europe/Berlin" }),
      });
      if (!calendarId(v.id)) throw new CalendarProviderError("unavailable");
      return v.id;
    },
  };
}
export type GoogleCalendarProvider = ReturnType<typeof googleCalendarProvider>;
