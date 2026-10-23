import "server-only";
import type { CoachPublicGroups } from "@/coaches/public-website";
import type {
  GroupCursor,
  GroupPage,
  GroupSession,
} from "@/domain/group-sessions";

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
