import "server-only";
import { sessionUuid } from "@/domain/session-types";
import { isCoachPublicSlug } from "@/domain/coaches";
import { isAvailabilityDate } from "@/domain/effective-availability";
import {
  parseTypedRequest,
  type SessionCatalog,
} from "@/domain/typed-sessions";
import {
  validConnectionPageOptions,
  type ConnectionPageOptions,
} from "@/domain/coach-athlete-connections";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { publicSessionCatalogRecord } from "@/server/db/coaches/public-session-catalog-repository";
import {
  SessionTypeError,
  ownedSessionTypes,
  ownedSessionTypeLocations,
} from "@/server/db/coaches/session-type-repository";
import { connectionPageRecord } from "@/server/db/connections/repository";
import {
  typedSessionTimesRecord,
  typedSessionCommandRecord,
  sessionBookingDetailRecord,
} from "@/server/db/coaches/typed-session-repository";
export async function publicSessionCatalog(
  slug: string,
): Promise<SessionCatalog | null> {
  if (!isCoachPublicSlug(slug)) return null;
  return publicSessionCatalogRecord(slug);
}

export async function publicSessionTimes(
  slug: string,
  typeId: string,
  locationId: string,
  date: string,
) {
  if (
    !isCoachPublicSlug(slug) ||
    !sessionUuid(typeId) ||
    !sessionUuid(locationId) ||
    !isAvailabilityDate(date)
  )
    return { status: "invalid" as const };
  try {
    const result = await withAuthorizedActor(async () => ({
      status: "ready" as const,
      // Keep the public availability projection on its own connection: an
      // owner's transaction context permits overrides that this view must not.
      times: await typedSessionTimesRecord(slug, typeId, locationId, date),
    }));
    return result.status === "authorized"
      ? result.value
      : {
          status:
            result.status === "preview"
              ? ("forbidden" as const)
              : result.status,
        };
  } catch {
    return { status: "unavailable" as const };
  }
}
export async function typedSessionCommand(value: unknown, coach = false) {
  const input = parseTypedRequest(value, coach);
  if (!input) return { status: "invalid" as const };
  try {
    const r = await withAuthorizedActor(
      async (tx) => ({
        status: "saved" as const,
        ...(await typedSessionCommandRecord(tx, input, coach)),
      }),
      { rethrow: (e) => e instanceof SessionTypeError },
    );
    return r.status === "authorized"
      ? r.value
      : { status: r.status === "preview" ? ("forbidden" as const) : r.status };
  } catch (error) {
    return {
      status:
        error instanceof SessionTypeError
          ? error.status
          : ("unavailable" as const),
    };
  }
}
export async function sessionBookingDetail(
  id: string,
  beforeRevision: number | null = null,
) {
  if (
    !sessionUuid(id) ||
    (beforeRevision !== null &&
      (!Number.isSafeInteger(beforeRevision) ||
        beforeRevision < 1 ||
        beforeRevision > 2147483647))
  )
    return { status: "invalid" as const };
  try {
    const r = await withAuthorizedActor(
      async (tx) => ({
        status: "ready" as const,
        detail: await sessionBookingDetailRecord(tx, id, beforeRevision),
      }),
      { rethrow: (e) => e instanceof SessionTypeError },
    );
    return r.status === "authorized"
      ? r.value
      : { status: r.status === "preview" ? ("forbidden" as const) : r.status };
  } catch (error) {
    return {
      status:
        error instanceof SessionTypeError
          ? error.status
          : ("unavailable" as const),
    };
  }
}
export async function coachSessionBookingOptions(
  options: ConnectionPageOptions = {},
) {
  if (!validConnectionPageOptions(options))
    return { status: "invalid" as const };
  const r = await withAuthorizedActor(async (tx, actor) => {
    const owner = await currentActorProjection(tx, actor);
    if (!["approved", "demo"].includes(owner.coachAccess.status))
      return { status: "forbidden" as const };
    return {
      status: "ready" as const,
      types: await ownedSessionTypes(tx, actor),
      athletes: await connectionPageRecord(tx, "coach", "accepted", options),
      locations: await ownedSessionTypeLocations(tx, actor),
    };
  });
  return r.status === "authorized"
    ? r.value
    : { status: r.status === "preview" ? ("forbidden" as const) : r.status };
}
