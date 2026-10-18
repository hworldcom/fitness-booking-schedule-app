import { Star } from "lucide-react";
import type { ReviewSummary } from "@/domain/coach-reviews";

export function CoachCardReviews({
  summary,
  concise = false,
}: {
  summary?: ReviewSummary | null;
  concise?: boolean;
}) {
  if (concise && (!summary || summary.count === 0)) return null;
  if (!summary)
    return <p className="coach-card-reviews muted">Reviews unavailable</p>;
  if (summary.count === 0)
    return (
      <p className="coach-card-reviews muted">
        {summary.fictional && <span>Demo reviews · </span>}
        No reviews yet
      </p>
    );
  const countLabel = `${summary.count} ${summary.count === 1 ? "review" : "reviews"}`;
  return (
    <p
      className="coach-card-reviews"
      aria-label={`${summary.fictional ? (concise ? "Fictional demo coach: " : "Demo reviews: ") : ""}${summary.mean!.toFixed(1)} out of 5 from ${countLabel}`}
    >
      <Star size={13} aria-hidden="true" />
      <strong>{summary.mean!.toFixed(1)}</strong>
      <span>({countLabel})</span>
      {summary.fictional && !concise && <span>· Demo reviews</span>}
    </p>
  );
}
