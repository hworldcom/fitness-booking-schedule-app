import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type {
  CoachAccessProjection,
  CoachApplicationStatus,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withDatabaseConnection, type DatabaseConnection } from "../client";
import {
  coachApplications,
  coachProfiles,
  demoRunParticipants,
  demoRuns,
  profiles,
} from "../schema";

export type ActorDatabaseTransaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

export type ActorProjection = Readonly<{
  profileSlug: string;
  displayName: string;
  coachAccess: CoachAccessProjection;
  runSlug: string;
  runName: string;
  role: "member" | "operator";
}>;

export class ActorContextRejectedError extends Error {
  constructor() {
    super("The verified actor is no longer authorized.");
    this.name = "ActorContextRejectedError";
  }
}

function isActorRole(value: string): value is "member" | "operator" {
  return value === "member" || value === "operator";
}

function isCoachApplicationStatus(
  value: string | null,
): value is CoachApplicationStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "suspended"
  );
}

function isoTimestamp(value: string | Date | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function withActorDatabaseContext<T>(
  actor: AuthorizedActor,
  work: (transaction: ActorDatabaseTransaction) => Promise<T>,
) {
  return withDatabaseConnection(({ db }) =>
    db.transaction(async (transaction) => {
      await transaction.execute(sql`
        select
          set_config('app.current_auth_user_id', ${actor.authUserId}, true),
          set_config('app.current_profile_id', ${actor.profileId}, true),
          set_config('app.current_run_id', ${actor.runId}, true),
          set_config('app.current_run_role', ${actor.runRole}, true)
      `);

      const validation = await transaction.execute<{ is_valid: boolean }>(sql`
        select app.authorized_actor_context_valid(
          ${actor.profileId}::uuid,
          ${actor.runId}::uuid,
          ${actor.runRole}::text
        ) as is_valid
      `);
      if (validation[0]?.is_valid !== true) {
        throw new ActorContextRejectedError();
      }

      return work(transaction);
    }),
  );
}

export async function currentActorProjection(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
): Promise<ActorProjection> {
  const rows = await transaction
    .select({
      profileSlug: profiles.slug,
      displayName: profiles.displayName,
      coachIsDemo: coachProfiles.isDemo,
      coachApplicationStatus: coachApplications.status,
      coachApplicationSubmittedAt: coachApplications.submittedAt,
      coachApplicationDecisionReason: coachApplications.decisionReason,
      coachApplicationPolicy: coachApplications.verificationPolicyVersion,
      runSlug: demoRuns.slug,
      runName: demoRuns.name,
      role: demoRunParticipants.role,
    })
    .from(profiles)
    .innerJoin(
      demoRunParticipants,
      and(
        eq(demoRunParticipants.profileId, profiles.id),
        eq(demoRunParticipants.runId, actor.runId),
      ),
    )
    .innerJoin(demoRuns, eq(demoRuns.id, demoRunParticipants.runId))
    .leftJoin(
      coachProfiles,
      and(
        eq(coachProfiles.profileId, profiles.id),
        eq(coachProfiles.runId, actor.runId),
      ),
    )
    .leftJoin(coachApplications, eq(coachApplications.profileId, profiles.id))
    .where(and(eq(profiles.id, actor.profileId), eq(demoRuns.id, actor.runId)));

  const row = rows[0];
  if (rows.length !== 1 || !row || !isActorRole(row.role)) {
    throw new ActorContextRejectedError();
  }
  if (
    row.coachApplicationStatus !== null &&
    !isCoachApplicationStatus(row.coachApplicationStatus)
  ) {
    throw new ActorContextRejectedError();
  }
  const coachAccess: CoachAccessProjection = Object.freeze(
    row.coachIsDemo === true
      ? {
          status: "demo",
          submittedAt: null,
          decisionReason: null,
          verificationPolicyVersion: null,
        }
      : {
          status: row.coachApplicationStatus ?? "not-applied",
          submittedAt: isoTimestamp(row.coachApplicationSubmittedAt),
          decisionReason: row.coachApplicationDecisionReason,
          verificationPolicyVersion: row.coachApplicationPolicy,
        },
  );
  return Object.freeze({
    profileSlug: row.profileSlug,
    displayName: row.displayName,
    coachAccess,
    runSlug: row.runSlug,
    runName: row.runName,
    role: row.role,
  });
}
