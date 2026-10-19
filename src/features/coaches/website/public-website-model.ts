import { coachProfileHref } from "@/domain/coach-public-url";
import type { CoachProjection } from "@/domain/coaches";
import type { CoachWebsite } from "@/domain/coach-website";
import {
  parsePublicReview,
  parseReviewSummary,
  type ReviewPageResult,
} from "@/domain/coach-reviews";
import type {
  GroupCursor,
  GroupPage,
  GroupSession,
} from "@/domain/group-sessions";

/** The origin must come from the existing validated site configuration, never a request Host. */
export function publicWebsiteIdentity(
  coach: CoachProjection,
  website: CoachWebsite | undefined,
  origin: string | null,
) {
  const path = coachProfileHref(coach);
  const title = website?.content.brandLabel
    ? `${coach.displayName} · ${website.content.brandLabel}`
    : `${coach.displayName} · Coach`;
  const description = (website?.content.introduction || coach.bio).slice(
    0,
    220,
  );
  const url = origin ? new URL(path, origin).href : null;
  const image = website?.banner?.hero.url || coach.portraitUrl;
  return {
    path,
    title,
    description,
    url,
    image: origin && image ? new URL(image, origin).href : null,
  };
}

/** Re-project the API response so extra/private fields never enter component state. */
export function parsePublicReviewPage(
  value: unknown,
): Extract<ReviewPageResult, { status: "ready" }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const summary = parseReviewSummary(v.summary);
  if (
    v.status !== "ready" ||
    !summary ||
    !Array.isArray(v.reviews) ||
    v.reviews.length > 20 ||
    !(
      v.nextCursor === null ||
      (typeof v.nextCursor === "string" &&
        /^[A-Za-z0-9_-]{1,512}$/.test(v.nextCursor))
    )
  )
    return null;
  const reviews = v.reviews.map(parsePublicReview);
  if (
    reviews.some((r) => r === null) ||
    (v.nextCursor !== null && reviews.length === 0)
  )
    return null;
  return {
    status: "ready",
    summary,
    reviews: reviews as NonNullable<(typeof reviews)[number]>[],
    nextCursor: v.nextCursor as string | null,
  };
}

export type CoachPublicGroups =
  | { status: "ready"; sessions: readonly GroupSession[] }
  | { status: "unavailable" };
/** Existing public authority owns eligibility. Scan bounded public pages, then match the exact coach.
 * A bounded/incomplete scan is unavailable, never a false claim that this coach has no groups. */
export async function loadCoachPublicGroups(
  slug: string,
  read: (after: GroupCursor | null) => Promise<GroupPage<GroupSession> | null>,
): Promise<CoachPublicGroups> {
  let after: GroupCursor | null = null;
  const seen = new Set<string>();
  const sessions: GroupSession[] = [];
  try {
    for (let page = 0; page < 20; page++) {
      const result = await read(after);
      if (!result) return { status: "unavailable" };
      for (const session of result.items)
        if (
          session.coach.slug === slug &&
          !sessions.some((s) => s.id === session.id)
        )
          sessions.push(session);
      if (sessions.length >= 6 || !result.nextCursor)
        return { status: "ready", sessions: sessions.slice(0, 6) };
      const key = JSON.stringify(result.nextCursor);
      if (seen.has(key)) return { status: "unavailable" };
      seen.add(key);
      after = result.nextCursor;
    }
  } catch {
    /* Optional group read must not hide a verified profile. */
  }
  return { status: "unavailable" };
}
