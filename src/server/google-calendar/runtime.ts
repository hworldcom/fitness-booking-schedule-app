import "server-only";
import { cookies } from "next/headers";
import { isCalendarResult, type CalendarResult } from "@/calendar/connection";
import { verifiedAuthContext } from "@/server/auth/session";
import {
  withAuthorizedActor,
  withAuthorizedSession,
} from "@/server/authorization/service";
import {
  calendarCommandRecord,
  calendarStatusRecord,
} from "@/server/db/google-calendar/repository";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  enableCalendarSync,
  prepareCalendarSync,
} from "@/server/db/google-calendar/setup-repository";
import { calendarExportAvailable } from "./export-worker";
import { calendarConfig } from "./config";
import { googleCalendarProvider } from "./provider";
import {
  calendarConnectionService,
  CalendarServiceError,
  type CalendarContext,
} from "./service";

export const CALENDAR_COOKIE = "movx-calendar-browser";
export async function currentCalendarConnection(): Promise<CalendarResult> {
  const result = await withAuthorizedActor(calendarStatusRecord);
  if (result.status !== "authorized")
    return {
      status: result.status === "preview" ? "forbidden" : result.status,
    };
  const safe = {
    status: "ready" as const,
    enabled: calendarConfig() !== null,
    connection: result.value,
  };
  return isCalendarResult(safe) ? safe : { status: "unavailable" };
}
export function calendarRuntime() {
  const config = calendarConfig();
  async function context(): Promise<CalendarContext> {
    const verified = await verifiedAuthContext();
    const result = await withAuthorizedSession(
      verified.session,
      async (_, actor) => actor,
    );
    if (result.status !== "authorized" || !verified.authSessionId)
      throw new CalendarServiceError(
        result.status === "signed-out"
          ? "signed-out"
          : result.status === "forbidden" || result.status === "preview"
            ? "forbidden"
            : "unavailable",
      );
    return {
      profileId: result.actor.profileId,
      runId: result.actor.runId,
      subject: result.actor.authUserId,
      sessionId: verified.authSessionId,
    };
  }
  async function withBoundContext<T>(
    bound: CalendarContext,
    work: (tx: ActorDatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    const verified = await verifiedAuthContext();
    if (
      verified.authSessionId !== bound.sessionId ||
      verified.session.status !== "signed-in" ||
      verified.session.subject !== bound.subject
    )
      throw new CalendarServiceError("forbidden");
    const result = await withAuthorizedSession(
      verified.session,
      async (tx, actor) => {
        if (actor.profileId !== bound.profileId || actor.runId !== bound.runId)
          throw new CalendarServiceError("forbidden");
        return work(tx);
      },
      { rethrow: (error) => error instanceof CalendarServiceError },
    );
    if (result.status !== "authorized")
      throw new CalendarServiceError(
        result.status === "forbidden" ? "forbidden" : "unavailable",
      );
    return result.value;
  }
  return calendarConnectionService({
    config,
    provider: config ? googleCalendarProvider(config) : null,
    context,
    bookingSync: {
      async prepare(bound, generation) {
        return withBoundContext(bound, (tx) =>
          calendarExportAvailable()
            ? prepareCalendarSync(tx, generation)
            : Promise.resolve(null),
        );
      },
      async enable(bound, generation, intent) {
        return withBoundContext(bound, (tx) =>
          calendarExportAvailable()
            ? enableCalendarSync(tx, generation, intent)
            : Promise.resolve("unavailable" as const),
        );
      },
    },
    reportFailure({ phase, reason }) {
      console.warn("Google Calendar connection attempt failed", {
        phase,
        reason,
      });
    },
    async command(bound, action, expected, input) {
      return withBoundContext(bound, (tx) =>
        calendarCommandRecord(tx, action, expected, input),
      );
    },
    cookie: {
      async read() {
        return (await cookies()).get(CALENDAR_COOKIE)?.value ?? null;
      },
      async write(value) {
        (await cookies()).set(CALENDAR_COOKIE, value ?? "", {
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https:") === true,
          path: "/auth/google-calendar",
          maxAge: value ? 600 : 0,
        });
      },
    },
  });
}
