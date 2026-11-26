// Only copied into the isolated booking-load rehearsal; no real Auth or SQL.
import "server-only";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  fixtureScenario,
  initialAuthorizationState,
} from "./coach-events-auth";
import { SessionTypeError } from "@/server/db/coaches/session-type-repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

const id = "19700000-0000-4000-8000-000000000001";
const state = globalThis as typeof globalThis & {
  bookingLoadCounts?: Record<string, number>;
};
export const counts = () => (state.bookingLoadCounts ??= {});
export function reset() {
  state.bookingLoadCounts = {};
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function count(key: string) {
  counts()[key] = (counts()[key] ?? 0) + 1;
}
export async function currentActorSnapshot() {
  count("pageActor");
  await delay(300);
  count("owner");
  await delay(150);
  return (await initialAuthorizationState()).actor;
}
export async function withAuthorizedActor<T>(
  work: (tx: ActorDatabaseTransaction, actor: AuthorizedActor) => Promise<T>,
  options?: { rethrow?: (error: unknown) => boolean },
) {
  count("authorization");
  await delay(300);
  const scenario = await fixtureScenario();
  const { actor, session } = await initialAuthorizationState();
  if (session.status !== "signed-in") return { status: "signed-out" as const };
  if (actor.status !== "authorized") return { status: "unavailable" as const };
  const authorized: AuthorizedActor = {
    authUserId: session.subject,
    profileId: id,
    runId: id,
    runRole: actor.role,
  };
  const owner = {
    profileSlug: actor.profile.slug,
    displayName: "Fixture coach",
    avatarStoragePath: null,
    avatarUpdatedAt: null,
    coachPublicSlug: "fixture",
    coachPortraitSource: null,
    coachPortraitPath: null,
    coachPortraitUpdatedAt: null,
    coachIsDemo: false,
    coachApplicationStatus:
      scenario.actor === "athlete"
        ? null
        : scenario.actor === "suspended"
          ? "suspended"
          : "approved",
    coachApplicationSubmittedAt: null,
    coachApplicationDecisionReason: null,
    coachApplicationPolicy: null,
    runSlug: actor.demoRun.slug,
    runName: actor.demoRun.name,
    role: actor.role,
  };
  const type = {
    id,
    format: "private",
    name: "Booking load fixture",
    description: "",
    color: "#123456",
    durationMinutes: 75,
    defaultLocationId: id,
    bookable: true,
    archived: false,
    revision: 0,
  };
  const detail = {
    bookingId: id,
    revision: scenario.fault === "changed" ? 1 : 0,
    status: "confirmed",
    startsAt:
      scenario.fault === "changed"
        ? "2030-11-09T19:00:00Z"
        : "2030-11-09T17:00:00Z",
    endsAt:
      scenario.fault === "changed"
        ? "2030-11-09T20:15:00Z"
        : "2030-11-09T18:15:00Z",
    locationId: id,
    venueName: "Fixture studio",
    sessionType: type,
    athleteId: null,
    externalClient: null,
    viewerIsCoach: scenario.actor !== "athlete",
    historyTotal: 0,
    nextHistoryRevision: null,
    changes: [],
  };
  function requireBooking(value: unknown) {
    if (value !== id || ["other", "other-run"].includes(scenario.actor))
      throw new SessionTypeError("forbidden");
    if (scenario.fault === "booking")
      throw Error("Fixture booking unavailable");
  }
  const builder = {
    from() {
      return this;
    },
    innerJoin() {
      return this;
    },
    leftJoin() {
      return this;
    },
    async where() {
      count("owner");
      await delay(150);
      return [owner];
    },
  };
  const tx = {
    select: () => builder,
    async execute(statement: Parameters<PgDialect["sqlToQuery"]>[0]) {
      const query = new PgDialect().sqlToQuery(statement);
      if (query.sql.includes("session_booking_detail")) {
        count("detail");
        await delay(150);
        requireBooking(query.params[0]);
        return [{ detail }];
      }
      if (query.sql.includes("session_notes_command")) {
        count("notes");
        await delay(150);
        requireBooking(JSON.parse(String(query.params[1])).bookingId);
        if (scenario.fault === "notes")
          throw Error("Fixture notes unavailable");
        return [
          {
            value: {
              bookingId: id,
              title: type.name,
              startsAt: detail.startsAt,
              endsAt: detail.endsAt,
              venue: "Fixture studio",
              status: "confirmed",
              viewerId: id,
              viewerIsCoach: detail.viewerIsCoach,
              canWrite: true,
              kind: "shared",
              conversationHref: null,
              plan: null,
              entries: [],
              next: null,
              total: 0,
            },
          },
        ];
      }
      if (query.sql.includes("coach_session_types")) {
        count("types");
        await delay(150);
        if (scenario.fault === "options")
          throw Error("Fixture options unavailable");
        return [{ types: [type] }];
      }
      if (query.sql.includes("external_clients")) {
        count("externalClients");
        await delay(150);
        return [{ result: { items: [], next: null } }];
      }
      if (query.sql.includes("current_coach_athlete_connections")) {
        count("athletes");
        await delay(150);
        return [];
      }
      if (query.sql.includes("coach_training_locations")) {
        count("locations");
        await delay(150);
        return [{ id, name: "Fixture studio" }];
      }
      throw Error("Unexpected fixture query");
    },
  } as unknown as ActorDatabaseTransaction;
  try {
    return {
      status: "authorized" as const,
      actor: authorized,
      value: await work(tx, authorized),
    };
  } catch (error) {
    if (options?.rethrow?.(error)) throw error;
    return { status: "unavailable" as const };
  }
}

export function sameWebsiteOrigin(request: Request) {
  return request.headers.get("origin") === "http://127.0.0.1:3168";
}
