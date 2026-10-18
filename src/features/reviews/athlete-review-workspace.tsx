"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { Modal } from "@/components/ui";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import type { PublicReview } from "@/domain/coach-reviews";
import {
  browserReviewTransport,
  previewCommand,
  ReviewWorkspace,
  type PairWorkspace,
} from "./review-workspace-model";

const WorkspaceContext = createContext<ReviewWorkspace | null>(null);

export function AthleteReviewWorkspace({ children }: { children: ReactNode }) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const scope =
    session.status === "signed-in" && actor.status === "authorized"
      ? `${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}`
      : null;
  return scope ? (
    <ScopedReviewWorkspace key={scope}>{children}</ScopedReviewWorkspace>
  ) : (
    <WorkspaceContext.Provider value={null}>
      {children}
    </WorkspaceContext.Provider>
  );
}

function ScopedReviewWorkspace({ children }: { children: ReactNode }) {
  const [workspace] = useState(
    () => new ReviewWorkspace(browserReviewTransport),
  );
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      const active = workspace.getSnapshot().active;
      if (active) void workspace.load(active);
    };
    window.addEventListener("focus", refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", refresh);
      // React's development effect replay must not dispose the live instance.
      queueMicrotask(() => {
        if (!mounted.current) workspace.dispose();
      });
    };
  }, [workspace]);
  const pair = snapshot.active ? snapshot.pairs[snapshot.active] : null;
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
      {snapshot.accessLost && (
        <p className="athlete-review-notice" role="alert">
          Review access has changed. Your private review workspace has been
          cleared. Reload the page to check your account.
        </p>
      )}
      {pair && (
        <Modal
          title={`Your review of ${pair.name}`}
          eyebrow="MOVX CLUB / YOUR REVIEW"
          onClose={() => workspace.close()}
        >
          <ReviewPanel pair={pair} workspace={workspace} />
        </Modal>
      )}
    </WorkspaceContext.Provider>
  );
}

export function AthleteReviewEntry({
  booking,
}: {
  booking: PrivateBookingProjection;
}) {
  const workspace = useContext(WorkspaceContext);
  return workspace ? (
    <ScopedReviewEntry workspace={workspace} booking={booking} />
  ) : null;
}
function ScopedReviewEntry({
  workspace,
  booking,
}: {
  workspace: ReviewWorkspace;
  booking: PrivateBookingProjection;
}) {
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  useEffect(() => workspace.ensure(booking), [workspace, booking]);
  const pair = snapshot.pairs[booking.coachSlug];
  if (
    snapshot.accessLost ||
    (pair?.saved && !pair.saved.eligible && !pair.saved.review)
  )
    return null;
  return (
    <div className="athlete-review-entry">
      <button
        type="button"
        className="button secondary"
        disabled={!pair || pair.loading}
        aria-label={`${pair?.saved?.review ? "View your review of" : pair?.saved?.eligible ? "Write a review of" : "Review options for"} ${booking.coachDisplayName}`}
        onClick={() => workspace.open(booking.coachSlug, booking.id)}
      >
        {pair?.loading
          ? "Checking review access…"
          : pair?.saved?.review
            ? "View / edit your review"
            : pair?.saved?.eligible
              ? "Write a review"
              : "Check review access"}
      </button>
      {pair?.saved?.review && (
        <small>One review per coach, across your sessions.</small>
      )}
    </div>
  );
}

export function ReviewPublication({ review }: { review: PublicReview }) {
  return (
    <div className="athlete-review-publication">
      <strong>{review.attribution}</strong>
      <p
        aria-label={`${review.rating} out of 5 stars`}
        className="athlete-review-score"
      >
        {"★".repeat(review.rating)}
        {"☆".repeat(5 - review.rating)} <span>{review.rating}/5</span>
      </p>
      {review.comment && (
        <p className="athlete-review-comment">{review.comment}</p>
      )}
      <small>From a booked session</small>
    </div>
  );
}

export function ReviewPanel({
  pair,
  workspace,
}: {
  pair: PairWorkspace;
  workspace: ReviewWorkspace;
}) {
  const fieldId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(pair.phase);
  useEffect(() => {
    if (previousPhase.current !== pair.phase) heading.current?.focus();
    previousPhase.current = pair.phase;
  }, [pair.phase]);
  const { slug, saved, draft } = pair;
  const disabled =
    pair.busy || pair.loading || pair.readFailed || !!pair.recovery;
  const command = previewCommand(pair);
  const review = saved?.review;
  return (
    <div className="athlete-review-panel" aria-busy={pair.busy || pair.loading}>
      <h3 ref={heading} tabIndex={-1}>
        {pair.phase === "preview"
          ? "Preview your review"
          : pair.phase === "edit"
            ? "Write your review"
            : "Your review"}
      </h3>
      <p>
        One review of this coach, across all your private sessions. You can edit
        or withdraw it later.
      </p>
      {pair.loading && <p role="status">Checking the latest review…</p>}
      {pair.message && (
        <p className="athlete-review-notice" role="status">
          {pair.message}
        </p>
      )}
      {pair.recovery === "uncertain" && (
        <div className="athlete-review-actions">
          <button
            className="button dark"
            type="button"
            disabled={pair.busy || pair.loading}
            onClick={() => void workspace.retry(slug)}
          >
            Retry the same save
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={pair.busy || pair.loading}
            onClick={() => void workspace.load(slug)}
          >
            Check latest review
          </button>
        </div>
      )}
      {pair.readFailed && !pair.recovery && (
        <button
          className="button secondary"
          type="button"
          disabled={pair.loading}
          onClick={() => void workspace.load(slug)}
        >
          Check review access again
        </button>
      )}
      {pair.recovery === "conflict" && (
        <div className="athlete-review-recovery">
          <h3>Review changed</h3>
          {pair.readFailed ? (
            <button
              className="button secondary"
              type="button"
              disabled={pair.loading}
              onClick={() => void workspace.load(slug)}
            >
              Load latest review
            </button>
          ) : (
            <>
              <p>
                Check the saved version below before continuing. Your draft has
                been kept.
              </p>
              <div className="athlete-review-actions">
                {draft && (
                  <button
                    className="button dark"
                    type="button"
                    disabled={pair.loading}
                    onClick={() => workspace.useLatest(slug, true)}
                  >
                    Keep my draft and use latest revision
                  </button>
                )}
                <button
                  className="button secondary"
                  type="button"
                  disabled={pair.loading}
                  onClick={() => workspace.useLatest(slug, false)}
                >
                  Use saved review
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {review && (pair.phase === "view" || pair.recovery === "conflict") && (
        <section aria-label="Saved review" className="athlete-review-saved">
          <h3>
            {!review.published
              ? "Withdrawn review"
              : review.moderationHidden
                ? "Review hidden by the platform"
                : "Saved review"}
          </h3>
          {review.published && !review.moderationHidden && (
            <p>Saved for publication while the coach’s page is public.</p>
          )}
          {review.moderationHidden && (
            <p>
              Editing or republishing does not remove the platform’s visibility
              restriction.
            </p>
          )}
          <ReviewPublication review={review} />
          {pair.phase === "view" && (
            <div className="athlete-review-actions">
              {saved?.eligible && (
                <button
                  className="button dark"
                  type="button"
                  disabled={disabled}
                  onClick={() => workspace.edit(slug)}
                >
                  {review.published ? "Edit review" : "Revise and republish"}
                </button>
              )}
              {review.published && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={disabled}
                  onClick={() => void workspace.withdraw(slug)}
                >
                  {pair.busy ? "Saving…" : "Withdraw review"}
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {saved && !saved.eligible && (
        <p>
          There is no eligible elapsed private session available for publishing
          this review.
        </p>
      )}
      {!review && saved?.eligible && pair.phase === "view" && (
        <button
          className="button dark"
          type="button"
          disabled={disabled}
          onClick={() => workspace.edit(slug)}
        >
          Write a review
        </button>
      )}
      {draft && pair.phase === "edit" && (
        <form
          className="athlete-review-form"
          onSubmit={(event) => {
            event.preventDefault();
            workspace.preview(slug);
          }}
        >
          <fieldset disabled={disabled}>
            <legend>Your rating</legend>
            <div className="athlete-review-ratings">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label key={rating}>
                  <input
                    type="radio"
                    name={`${fieldId}-rating`}
                    value={rating}
                    checked={draft.rating === rating}
                    required
                    onChange={() => workspace.change(slug, { rating })}
                  />
                  <span>
                    {rating} <span aria-hidden="true">★</span>
                    <span className="sr-only">
                      {" "}
                      {rating === 1 ? "star" : "stars"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`${fieldId}-name`}>Public review name</label>
          <input
            id={`${fieldId}-name`}
            value={draft.attribution}
            autoComplete="off"
            disabled={disabled}
            aria-describedby={`${fieldId}-privacy`}
            required
            onChange={(event) =>
              workspace.change(slug, { attribution: event.target.value })
            }
          />
          <small id={`${fieldId}-privacy`}>
            Choose 2–80 characters. This name will be public. Your account name
            and picture are not added.
          </small>
          <label htmlFor={`${fieldId}-comment`}>
            Your review <span>(optional)</span>
          </label>
          <textarea
            id={`${fieldId}-comment`}
            rows={5}
            value={draft.comment}
            disabled={disabled}
            aria-describedby={`${fieldId}-limit`}
            onChange={(event) =>
              workspace.change(slug, { comment: event.target.value })
            }
          />
          <small id={`${fieldId}-limit`}>
            {[...draft.comment].length.toLocaleString("en-GB")} / 2,000
            characters. Avoid private contact or session details.
          </small>
          <button className="button dark" type="submit" disabled={disabled}>
            Preview public review
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={() => workspace.discard(slug)}
          >
            Discard draft
          </button>
        </form>
      )}
      {draft && pair.phase === "preview" && command && (
        <section
          aria-label="Public review preview"
          className="athlete-review-preview"
        >
          <h3>What people will see</h3>
          <ReviewPublication
            review={{ ...command, createdAt: "", updatedAt: "" }}
          />
          <label className="athlete-review-consent">
            <input
              type="checkbox"
              checked={pair.consent}
              disabled={disabled}
              onChange={(event) =>
                workspace.consent(slug, event.target.checked)
              }
            />
            <span>
              I agree to publish this rating, review and chosen public name on
              MOVX.
            </span>
          </label>
          <div className="athlete-review-actions">
            <button
              className="button dark"
              type="button"
              disabled={disabled || !pair.consent || !saved?.eligible}
              onClick={() => void workspace.publish(slug)}
            >
              {pair.busy
                ? "Saving…"
                : review?.published
                  ? "Publish changes"
                  : "Publish review"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={disabled}
              onClick={() => workspace.edit(slug)}
            >
              Back to editing
            </button>
          </div>
        </section>
      )}
      {pair.summary && (
        <p className="athlete-review-summary" role="status">
          {pair.summary === "loading" ? (
            "Refreshing the public rating…"
          ) : pair.summary === "unavailable" ? (
            "The public rating could not be checked. Your saved review is shown above."
          ) : (
            <>
              {pair.summary.fictional && "Fictional coach · "}
              {pair.summary.count === 0
                ? "No public reviews"
                : `${pair.summary.mean?.toFixed(1)}/5 · ${pair.summary.count} public ${pair.summary.count === 1 ? "review" : "reviews"}`}
            </>
          )}
        </p>
      )}
      <small className="athlete-review-draft-note">
        Unpublished drafts stay on this page only. Closing this window keeps
        your draft; leaving the page clears it.
      </small>
    </div>
  );
}
