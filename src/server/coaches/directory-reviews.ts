import "server-only";
import type { ReviewSummary } from "@/domain/coach-reviews";
import { publicCoachReviewSummaries } from "./review-service";

/** Keep all matches, while respecting the public summary service's batch limit. */
export async function directoryReviewSummaries(
  slugs: readonly string[],
  load: typeof publicCoachReviewSummaries = publicCoachReviewSummaries,
): Promise<ReadonlyMap<string, ReviewSummary>> {
  const unique = [...new Set(slugs)];
  const summaries = new Map<string, ReviewSummary>();
  for (let start = 0; start < unique.length; start += 256) {
    const batch = unique.slice(start, start + 256);
    try {
      const result = await load(batch);
      if (result.status === "ready") {
        for (const slug of batch) {
          const summary = result.summaries.get(slug);
          if (summary) summaries.set(slug, summary);
        }
      }
    } catch {
      // A review outage must not erase working coach discovery or imply zero.
    }
  }
  return summaries;
}
