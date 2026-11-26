import "server-only";
import type {
  GroupCursor,
  GroupPage,
  GroupSession,
} from "@/domain/group-sessions";

/** One bounded public scan for the whole directory, never one request per coach. */
export async function directoryGroupCoachSlugs(
  read: (after: GroupCursor | null) => Promise<GroupPage<GroupSession> | null>,
): Promise<ReadonlySet<string> | null> {
  let after: GroupCursor | null = null;
  const seen = new Set<string>();
  const slugs = new Set<string>();
  try {
    for (let page = 0; page < 20; page++) {
      const result = await read(after);
      if (!result) return null;
      for (const item of result.items) slugs.add(item.coach.slug);
      if (!result.nextCursor) return slugs;
      const key = JSON.stringify(result.nextCursor);
      if (seen.has(key)) return null;
      seen.add(key);
      after = result.nextCursor;
    }
  } catch {
    /* Public group authority unavailable; do not claim an empty result. */
  }
  return null;
}
