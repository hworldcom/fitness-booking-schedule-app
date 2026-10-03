import "server-only";

import { sql } from "drizzle-orm";
import {
  COACH_POST_PAGE_SIZE,
  encodeCoachPostCursor,
  type CoachPost,
  type CoachPostCursor,
  type CoachPostPage,
  type CoachPostVisibility,
} from "@/domain/coach-social";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

type CoachPostProjectionRow = Readonly<{
  id: string;
  coach_profile_id: string;
  public_slug: string;
  display_name: string;
  body: string;
  visibility: string;
  published_at: string | Date;
  record_source: string;
}>;

export class CoachSocialConflictError extends Error {
  constructor(message = "The coach social state conflicts with this request.") {
    super(message);
    this.name = "CoachSocialConflictError";
  }
}

function mapPost(row: CoachPostProjectionRow): CoachPost {
  if (
    (row.visibility !== "visible" && row.visibility !== "hidden") ||
    (row.record_source !== "fixture" && row.record_source !== "user")
  ) {
    throw new CoachSocialConflictError();
  }
  return Object.freeze({
    id: row.id,
    coachProfileId: row.coach_profile_id,
    coachSlug: row.public_slug,
    coachDisplayName: row.display_name,
    body: row.body,
    visibility: row.visibility,
    publishedAt: new Date(row.published_at).toISOString(),
    recordSource: row.record_source,
  });
}

function postPage(rows: readonly CoachPostProjectionRow[]): CoachPostPage {
  const hasNextPage = rows.length > COACH_POST_PAGE_SIZE;
  const posts = rows.slice(0, COACH_POST_PAGE_SIZE).map(mapPost);
  const lastPost = posts.at(-1);
  return Object.freeze({
    posts: Object.freeze(posts),
    nextCursor:
      hasNextPage && lastPost ? encodeCoachPostCursor(lastPost) : null,
  });
}

function isSocialPostgresError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      current.code === "P0001" &&
      "message" in current &&
      typeof current.message === "string" &&
      (current.message.includes("coach follow") ||
        current.message.includes("coach post"))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function publicCoachPostRecords(
  coachProfileId: string,
  limit = 3,
) {
  const boundedLimit = Math.max(1, Math.min(limit, COACH_POST_PAGE_SIZE));
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<CoachPostProjectionRow>(sql`
      select
        post.id,
        post.coach_profile_id,
        coach.public_slug,
        coach.display_name,
        post.body,
        post.visibility,
        post.published_at,
        post.record_source
      from app.coach_posts as post
      join app.coach_profiles as coach
        on coach.run_id = post.run_id
        and coach.profile_id = post.coach_profile_id
      where post.coach_profile_id = ${coachProfileId}::uuid
        and post.visibility = 'visible'
        and coach.visibility = 'visible'
      order by post.published_at desc, post.id desc
      limit ${boundedLimit}
    `);
    return Object.freeze(rows.map(mapPost));
  });
}

export async function currentCoachFollowRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  coachProfileId: string,
) {
  const rows = await transaction.execute<{ following: boolean }>(sql`
    select exists (
      select 1
      from app.coach_follows as follow
      where follow.run_id = ${actor.runId}::uuid
        and follow.follower_profile_id = ${actor.profileId}::uuid
        and follow.coach_profile_id = ${coachProfileId}::uuid
    ) as following
  `);
  return rows[0]?.following === true;
}

export async function followingCoachPostRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  cursor: CoachPostCursor | null,
) {
  const rows = await transaction.execute<CoachPostProjectionRow>(sql`
    select
      post.id,
      post.coach_profile_id,
      coach.public_slug,
      coach.display_name,
      post.body,
      post.visibility,
      post.published_at,
      post.record_source
    from app.coach_posts as post
    join app.coach_follows as follow
      on follow.run_id = post.run_id
      and follow.coach_profile_id = post.coach_profile_id
      and follow.follower_profile_id = ${actor.profileId}::uuid
    join app.coach_profiles as coach
      on coach.run_id = post.run_id
      and coach.profile_id = post.coach_profile_id
    where post.run_id = ${actor.runId}::uuid
      and post.visibility = 'visible'
      and coach.visibility = 'visible'
      and (
        ${cursor?.publishedAt ?? null}::timestamptz is null
        or (post.published_at, post.id) < (
          ${cursor?.publishedAt ?? null}::timestamptz,
          ${cursor?.id ?? null}::uuid
        )
      )
    order by post.published_at desc, post.id desc
    limit ${COACH_POST_PAGE_SIZE + 1}
  `);
  return postPage(rows);
}

export async function ownedCoachPostRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<CoachPostProjectionRow>(sql`
    select
      post.id,
      post.coach_profile_id,
      coach.public_slug,
      coach.display_name,
      post.body,
      post.visibility,
      post.published_at,
      post.record_source
    from app.coach_posts as post
    join app.coach_profiles as coach
      on coach.run_id = post.run_id
      and coach.profile_id = post.coach_profile_id
    where post.run_id = ${actor.runId}::uuid
      and post.coach_profile_id = ${actor.profileId}::uuid
    order by post.published_at desc, post.id desc
    limit 100
  `);
  return Object.freeze(rows.map(mapPost));
}

export async function setOwnedCoachFollowRecord(
  transaction: ActorDatabaseTransaction,
  coachProfileId: string,
  following: boolean,
) {
  try {
    const rows = await transaction.execute<{ following: boolean }>(sql`
      select app.set_owned_coach_follow(
        ${coachProfileId}::uuid,
        ${following}::boolean
      ) as following
    `);
    if (rows.length !== 1 || rows[0]?.following !== following) {
      throw new CoachSocialConflictError();
    }
    return following;
  } catch (error) {
    if (error instanceof CoachSocialConflictError) throw error;
    if (isSocialPostgresError(error)) throw new CoachSocialConflictError();
    throw error;
  }
}

export async function createOwnedCoachPostRecord(
  transaction: ActorDatabaseTransaction,
  body: string,
) {
  try {
    const rows = await transaction.execute<{ post_id: string }>(sql`
      select app.create_owned_coach_post(${body}::text) as post_id
    `);
    const postId = rows[0]?.post_id;
    if (rows.length !== 1 || !postId) throw new CoachSocialConflictError();
    return postId;
  } catch (error) {
    if (error instanceof CoachSocialConflictError) throw error;
    if (isSocialPostgresError(error)) throw new CoachSocialConflictError();
    throw error;
  }
}

export async function setOwnedCoachPostVisibilityRecord(
  transaction: ActorDatabaseTransaction,
  postId: string,
  visibility: CoachPostVisibility,
) {
  try {
    const rows = await transaction.execute<{ visibility: string }>(sql`
      select app.set_owned_coach_post_visibility(
        ${postId}::uuid,
        ${visibility}::text
      ) as visibility
    `);
    if (rows.length !== 1 || rows[0]?.visibility !== visibility) {
      throw new CoachSocialConflictError();
    }
    return visibility;
  } catch (error) {
    if (error instanceof CoachSocialConflictError) throw error;
    if (isSocialPostgresError(error)) throw new CoachSocialConflictError();
    throw error;
  }
}
