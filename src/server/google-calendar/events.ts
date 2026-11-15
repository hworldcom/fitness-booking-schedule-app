import "server-only";
import { calendarId, calendarUuid } from "@/calendar/connection";

export type ExportFailure =
  | "transient"
  | "authorization-required"
  | "calendar-missing"
  | "event-missing"
  | "ownership-conflict"
  | "outcome-unknown";
export class CalendarEventError extends Error {
  constructor(public readonly kind: ExportFailure | "missing") {
    super("Calendar copy could not be synchronized.");
  }
}
export type ExportTerms = Readonly<{
  action: "upsert";
  title: "MovX private session" | "MovX group session";
  startsAt: string;
  endsAt: string;
  location: string;
  path: string;
}>;
export type EventMetadata = Readonly<{
  id: string;
  status: string;
  etag: string;
  marker: string | null;
  hasAttendees: boolean;
}>;
export function isExportTerms(value: unknown): value is ExportTerms {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as ExportTerms;
  return (
    Object.keys(v).length === 6 &&
    v.action === "upsert" &&
    ["MovX private session", "MovX group session"].includes(v.title) &&
    typeof v.startsAt === "string" &&
    typeof v.endsAt === "string" &&
    Number.isFinite(Date.parse(v.startsAt)) &&
    Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
    typeof v.location === "string" &&
    v.location.length <= 500 &&
    typeof v.path === "string" &&
    (/^\/(?:coach\/)?sessions\/[a-f0-9-]{36}$/.test(v.path) ||
      /^\/coach\/events\/[a-f0-9-]{36}$/.test(v.path) ||
      v.path === "/sessions/groups")
  );
}
export function calendarEventProvider(
  siteUrl: string,
  transport: typeof fetch = fetch,
) {
  const origin = new URL(siteUrl);
  if (
    origin.origin !== siteUrl ||
    !["https:", "http:"].includes(origin.protocol) ||
    (origin.protocol === "http:" && origin.hostname !== "localhost")
  )
    throw new CalendarEventError("transient");
  function endpoint(calendar: string, event?: string) {
    if (
      !calendarId(calendar) ||
      (event !== undefined && !/^[a-v0-9]{5,1024}$/.test(event))
    )
      throw new CalendarEventError("ownership-conflict");
    return (
      "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(calendar) +
      "/events" +
      (event ? "/" + encodeURIComponent(event) : "")
    );
  }
  async function request(
    url: string,
    token: string,
    init: RequestInit = {},
    empty = false,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await transport(url, {
        ...init,
        headers: { authorization: "Bearer " + token, ...init.headers },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > 65536) {
              await reader.cancel();
              throw new CalendarEventError("transient");
            }
            chunks.push(part.value);
          }
        } finally {
          reader.releaseLock();
        }
      let body: Record<string, unknown> = {};
      if (chunks.length) {
        const raw: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new CalendarEventError("transient");
        body = raw as Record<string, unknown>;
      }
      if (!response.ok) {
        const reason = (
          body.error as { errors?: { reason?: string }[] } | undefined
        )?.errors?.[0]?.reason;
        throw new CalendarEventError(
          response.status === 404 || response.status === 410
            ? "missing"
            : response.status === 409 ||
                response.status === 412 ||
                response.status === 429 ||
                response.status >= 500 ||
                (response.status === 403 &&
                  [
                    "rateLimitExceeded",
                    "userRateLimitExceeded",
                    "quotaExceeded",
                  ].includes(reason ?? ""))
              ? "transient"
              : response.status === 401 || response.status === 403
                ? "authorization-required"
                : "ownership-conflict",
        );
      }
      if (!empty && !chunks.length) throw new CalendarEventError("transient");
      return body;
    } catch (error) {
      if (error instanceof CalendarEventError) throw error;
      throw new CalendarEventError("transient");
    }
  }
  function metadata(
    value: Record<string, unknown>,
    expected: string,
  ): EventMetadata {
    if (
      value.id !== expected ||
      typeof value.status !== "string" ||
      (value.status !== "cancelled" &&
        (typeof value.etag !== "string" ||
          !value.etag ||
          value.etag.length > 512 ||
          /[\r\n]/.test(value.etag))) ||
      (value.attendees !== undefined && !Array.isArray(value.attendees))
    )
      throw new CalendarEventError("transient");
    const marker = (
      value.extendedProperties as
        { private?: { movxRef?: unknown } } | undefined
    )?.private?.movxRef;
    return {
      id: expected,
      status: value.status,
      etag: typeof value.etag === "string" ? value.etag : "",
      marker: typeof marker === "string" ? marker : null,
      hasAttendees:
        Array.isArray(value.attendees) && value.attendees.length > 0,
    };
  }
  const fields = "id,status,etag,extendedProperties,attendees(self)";
  const payload = (terms: ExportTerms, marker: string) => {
    if (!isExportTerms(terms) || !calendarUuid(marker))
      throw new CalendarEventError("ownership-conflict");
    return {
      summary: terms.title,
      location: terms.location,
      description:
        "View this booking in MovX: " + new URL(terms.path, origin).toString(),
      start: {
        dateTime: new Date(terms.startsAt).toISOString(),
        timeZone: "Europe/Berlin",
      },
      end: {
        dateTime: new Date(terms.endsAt).toISOString(),
        timeZone: "Europe/Berlin",
      },
      visibility: "private",
      transparency: "opaque",
      extendedProperties: { private: { movxRef: marker } },
    };
  };
  return {
    async get(token: string, calendar: string, event: string) {
      return metadata(
        await request(
          endpoint(calendar, event) + "?fields=" + encodeURIComponent(fields),
          token,
        ),
        event,
      );
    },
    async create(
      token: string,
      calendar: string,
      event: string,
      marker: string,
      terms: ExportTerms,
    ) {
      endpoint(calendar, event);
      const value = await request(
        endpoint(calendar) +
          "?sendUpdates=none&fields=" +
          encodeURIComponent(fields),
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: event, ...payload(terms, marker) }),
        },
      );
      const result = metadata(value, event);
      if (
        result.marker !== marker ||
        result.hasAttendees ||
        result.status === "cancelled"
      )
        throw new CalendarEventError("ownership-conflict");
    },
    async update(
      token: string,
      calendar: string,
      event: string,
      marker: string,
      terms: ExportTerms,
      etag: string,
    ) {
      const value = await request(
        endpoint(calendar, event) +
          "?sendUpdates=none&fields=" +
          encodeURIComponent(fields),
        token,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "if-match": etag },
          body: JSON.stringify(payload(terms, marker)),
        },
      );
      const result = metadata(value, event);
      if (
        result.marker !== marker ||
        result.hasAttendees ||
        result.status === "cancelled"
      )
        throw new CalendarEventError("ownership-conflict");
    },
    async remove(token: string, calendar: string, event: string, etag: string) {
      await request(
        endpoint(calendar, event) + "?sendUpdates=none",
        token,
        { method: "DELETE", headers: { "if-match": etag } },
        true,
      );
    },
  };
}
export type CalendarEventProvider = ReturnType<typeof calendarEventProvider>;
