"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Star } from "lucide-react";
import type { ReviewSummary } from "@/domain/coach-reviews";
import type { ReviewPageResult } from "@/domain/coach-reviews";
import { parsePublicReviewPage } from "./public-website-model";

const SummaryContext = createContext<{
  summary: ReviewSummary | null;
  update: (summary: ReviewSummary) => void;
} | null>(null);
export function PublicReviewsProvider({
  initial,
  children,
}: {
  initial: ReviewSummary | null;
  children: ReactNode;
}) {
  const [summary, update] = useState(initial);
  return (
    <SummaryContext.Provider value={{ summary, update }}>
      {children}
    </SummaryContext.Provider>
  );
}
export function PublicReviewRating() {
  const value = useContext(SummaryContext);
  const summary = value?.summary;
  if (!summary) return null;
  return (
    <a href="#reviews">
      <Star size={16} aria-hidden="true" />
      {summary.count
        ? `${summary.mean?.toFixed(1)} · ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`
        : "No public reviews yet"}
      {summary.fictional ? " · Demo" : ""}
    </a>
  );
}

export function PublicCoachReviews({
  slug,
  initial,
}: {
  slug: string;
  initial: ReviewPageResult;
}) {
  const summaryContext = useContext(SummaryContext);
  const [page, setPage] = useState(initial.status === "ready" ? initial : null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initial.status !== "ready");
  const loading = useRef(false);
  async function load() {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setFailed(false);
    const cursor = page?.nextCursor ?? null;
    try {
      const response = await fetch(
        `/api/coaches/${encodeURIComponent(slug)}/reviews${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        {
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.timeout(15000),
        },
      );
      const next = response.ok
        ? parsePublicReviewPage(await response.json())
        : null;
      if (!next || (cursor !== null && next.nextCursor === cursor))
        throw new Error("Reviews unavailable");
      summaryContext?.update(next.summary);
      // An append does not revise already-read entries. Refresh rechecks withdrawal/moderation.
      setPage((previous) => ({
        ...next,
        reviews:
          cursor && previous
            ? [...previous.reviews, ...next.reviews]
            : next.reviews,
      }));
    } catch {
      setFailed(true);
    } finally {
      loading.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="reviews"
      tabIndex={-1}
      className="coach-website-section"
      aria-labelledby="coach-reviews-title"
    >
      <span className="eyebrow">ATHLETE EXPERIENCES</span>
      <h2 id="coach-reviews-title">Reviews</h2>
      {page && (
        <p>
          {page.summary.count > 0
            ? `${page.summary.mean?.toFixed(1)} out of 5 · ${page.summary.count} ${page.summary.count === 1 ? "review" : "reviews"}`
            : "No public reviews yet."}
          {page.summary.fictional && " Fictional demo reviews."}
        </p>
      )}
      {page?.reviews.map((review, index) => (
        <article
          className="coach-public-review"
          key={`${review.createdAt}:${index}`}
        >
          <div>
            <strong>{review.attribution}</strong>
            <span aria-label={`${review.rating} out of 5 stars`}>
              {"★".repeat(review.rating)}
              <span aria-hidden="true">{"☆".repeat(5 - review.rating)}</span>
            </span>
          </div>
          {review.comment && <p>{review.comment}</p>}
          <time dateTime={review.updatedAt}>
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Europe/Berlin",
            }).format(new Date(review.updatedAt))}
          </time>
        </article>
      ))}
      {failed && (
        <p role="status">
          {page
            ? "Couldn’t load more reviews. Please try again. Reviews already loaded are still available."
            : "Reviews are unavailable. Please try again."}
        </p>
      )}
      {(!page || page.nextCursor) && (
        <button type="button" onClick={() => void load()} disabled={busy}>
          {busy
            ? "Loading reviews…"
            : failed
              ? "Retry reviews"
              : "Load more reviews"}
        </button>
      )}
    </section>
  );
}
