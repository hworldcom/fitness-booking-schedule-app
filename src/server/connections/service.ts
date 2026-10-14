import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  isConnectionDecision,
  isConnectionRole,
  isConnectionSection,
  validConnectionPageOptions,
  type ConnectionDecision,
  type ConnectionPageOptions,
  type ConnectionRole,
  type ConnectionSection,
} from "@/domain/coach-athlete-connections";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  bookingConnectionContextRecord,
  ConnectionConflictError,
  connectionHistoryRecord,
  connectionPageRecord,
  decideConnectionRecord,
  sendConnectionRecord,
} from "@/server/db/connections/repository";

export type ConnectionResult<T> =
  | Readonly<{ status: "ready"; value: T }>
  | Readonly<{
      status:
        | "invalid"
        | "conflict"
        | "preview"
        | "signed-out"
        | "forbidden"
        | "unavailable";
    }>;
function validId(value: unknown): value is string {
  return typeof value === "string" && isCanonicalUuid(value);
}

async function connectionWork<T>(
  work: Parameters<typeof withAuthorizedActor<T>>[0],
): Promise<ConnectionResult<T>> {
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) =>
        Object.freeze({
          status: "ready" as const,
          value: await work(tx, actor),
        }),
      { rethrow: (error) => error instanceof ConnectionConflictError },
    );
    return result.status === "authorized" ? result.value : result;
  } catch (error) {
    if (error instanceof ConnectionConflictError)
      return Object.freeze({ status: "conflict" as const });
    throw error;
  }
}
export function currentBookingConnectionContext(bookingId: string) {
  if (!validId(bookingId))
    return Promise.resolve({ status: "invalid" as const });
  return connectionWork((tx) => bookingConnectionContextRecord(tx, bookingId));
}
export function sendCoachAthleteConnection(
  bookingId: string,
  operationId: string,
  previousId: string | null,
) {
  if (
    !validId(bookingId) ||
    !validId(operationId) ||
    (previousId !== null && !validId(previousId))
  )
    return Promise.resolve({ status: "invalid" as const });
  return connectionWork((tx) =>
    sendConnectionRecord(tx, bookingId, operationId, previousId),
  );
}
export function decideCoachAthleteConnection(
  id: string,
  action: ConnectionDecision,
) {
  if (!validId(id) || !isConnectionDecision(action))
    return Promise.resolve({ status: "invalid" as const });
  return connectionWork((tx) => decideConnectionRecord(tx, id, action));
}
export function currentConnectionPage(
  role: ConnectionRole,
  section: ConnectionSection,
  options: ConnectionPageOptions = {},
) {
  if (
    !isConnectionRole(role) ||
    !isConnectionSection(section) ||
    !validConnectionPageOptions(options)
  )
    return Promise.resolve({ status: "invalid" as const });
  return connectionWork((tx) =>
    connectionPageRecord(tx, role, section, options),
  );
}
export function currentConnectionHistory(
  pairId: string,
  options: ConnectionPageOptions = {},
) {
  if (!validId(pairId) || !validConnectionPageOptions(options))
    return Promise.resolve({ status: "invalid" as const });
  return connectionWork((tx) => connectionHistoryRecord(tx, pairId, options));
}
