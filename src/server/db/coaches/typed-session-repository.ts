import "server-only";
import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  withDatabaseConnection,
  type DatabaseConnection,
} from "@/server/db/client";
import { publicScheduleSelection } from "@/domain/public-coach-schedule";
import { parseSessionWeek } from "@/domain/session-week";
import type {
  SessionTime,
  TypedSessionRequest,
  CoachSessionCommand,
  SessionBookingDetail,
} from "@/domain/typed-sessions";
import { sessionUuid } from "@/domain/session-types";
import { sessionMutationError } from "./session-type-repository";

export async function typedSessionWeekRecord(
  slug: string,
  typeId: string,
  locationId: string,
  weekOf: string,
  connection?: DatabaseConnection,
) {
  return withDatabaseConnection(async ({ db }) => {
    const [clock] = await db.execute<{ reference_time: string }>(
      sql`select clock_timestamp()::text as reference_time`,
    );
    const referenceTime = new Date(clock.reference_time).toISOString();
    const selection = publicScheduleSelection(weekOf, referenceTime);
    // One bounded statement/connection, rather than seven authenticated HTTP reads.
    // Keep this outside the owner's actor transaction so owner overrides cannot
    // enter the ordinary public availability projection.
    const days = await db.execute<{ date: string; times: SessionTime[] }>(sql`
      select to_char(day.date, 'YYYY-MM-DD') as date,
        app.public_session_type_times(${slug}, ${typeId}::uuid,
          ${locationId}::uuid, day.date) as times
      from (values ${sql.join(
        selection.dates.map((date) => sql`(${date}::date)`),
        sql`, `,
      )}) as day(date)
      order by day.date
    `);
    return parseSessionWeek(
      { referenceTime, resetToCurrent: !selection.inHorizon, days },
      weekOf,
    );
  }, connection);
}

export async function typedSessionTimesRecord(
  slug: string,
  typeId: string,
  locationId: string,
  date: string,
) {
  return withDatabaseConnection(async ({ db }) => {
    const [row] = await db.execute<{ times: SessionTime[] }>(
      sql`select app.public_session_type_times(${slug},${typeId}::uuid,${locationId}::uuid,${date}::date) times`,
    );
    if (
      !Array.isArray(row.times) ||
      row.times.length > 100 ||
      row.times.some(
        (t) =>
          !t ||
          !Number.isFinite(Date.parse(t.startsAt)) ||
          !Number.isFinite(Date.parse(t.endsAt)) ||
          ![60, 75, 90].includes(
            (Date.parse(t.endsAt) - Date.parse(t.startsAt)) / 60000,
          ),
      )
    )
      throw new Error("Invalid typed availability");
    return row.times;
  });
}
export async function typedSessionCommandRecord(
  tx: ActorDatabaseTransaction,
  input: TypedSessionRequest | CoachSessionCommand,
  coach: boolean,
) {
  try {
    const { commandId, ...payload } = input;
    const fn = coach
      ? sql`app.coach_session_booking`
      : sql`app.request_session_type`;
    const [row] = await tx.execute<{
      result: {
        requestId?: string;
        requestStatus?: string;
        bookingId?: string | null;
        revision?: number;
      };
    }>(
      sql`select ${fn}(${commandId}::uuid,${JSON.stringify(payload)}::jsonb) result`,
    );
    const result = row?.result;
    if (
      !result ||
      typeof result !== "object" ||
      (coach
        ? !sessionUuid(result.bookingId) ||
          !Number.isSafeInteger(result.revision) ||
          Number(result.revision) < 0
        : !sessionUuid(result.requestId) ||
          typeof result.requestStatus !== "string" ||
          (result.bookingId !== null && !sessionUuid(result.bookingId)))
    )
      throw new Error("Invalid typed booking result.");
    return result;
  } catch (error) {
    return sessionMutationError(error);
  }
}
export async function sessionBookingDetailRecord(
  tx: ActorDatabaseTransaction,
  id: string,
  beforeRevision: number | null = null,
) {
  try {
    const [row] = await tx.execute<{ detail: SessionBookingDetail }>(
      sql`select app.session_booking_detail(${id}::uuid,${beforeRevision}::integer) detail`,
    );
    if (
      !row.detail ||
      row.detail.bookingId !== id ||
      !Array.isArray(row.detail.changes) ||
      row.detail.changes.length > 20 ||
      !Number.isSafeInteger(row.detail.historyTotal) ||
      row.detail.historyTotal < row.detail.changes.length ||
      (row.detail.nextHistoryRevision !== null &&
        (!Number.isSafeInteger(row.detail.nextHistoryRevision) ||
          row.detail.nextHistoryRevision < 1))
    )
      throw new Error("Invalid booking detail");
    return row.detail;
  } catch (error) {
    return sessionMutationError(error);
  }
}
