"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  RotateCcw,
} from "lucide-react";
import type { MembershipPlanId } from "@/domain/catalogue";
import {
  isMembershipDraftReviewable,
  membershipDraftGyms,
  membershipDraftPlan,
  REQUIRED_CORE_GYMS,
  type MembershipDraftIssue,
} from "@/domain/membership-draft";
import { useMembershipDraft } from "@/features/membership/draft-store";
import { plans, studios } from "@/features/preview/catalogue";

const catalogue = { plans, gyms: studios };

function accessLabel(planId: MembershipPlanId) {
  const plan = plans.find((candidate) => candidate.id === planId);
  if (!plan) return "";
  return plan.access.model === "limited"
    ? `${plan.access.includedCheckins} included check-ins`
    : "Unlimited included check-ins";
}

function issueMessage(issue: MembershipDraftIssue | null) {
  switch (issue) {
    case "choose-plan-first":
      return "Choose Basic or Classic before selecting gyms.";
    case "gym-ineligible":
      return "That gym is not eligible for the selected plan.";
    case "maximum-gyms":
      return "Your core set already has four gyms. Remove one before choosing another.";
    case "unknown-gym":
    case "unknown-plan":
      return "That preview option is no longer available. Please choose again.";
    default:
      return null;
  }
}

export function MembershipSetup({
  initialPlan,
}: {
  initialPlan: MembershipPlanId | null;
}) {
  const { draft, recovery, storageUnavailable, dispatch } =
    useMembershipDraft();
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const initializedFromQuery = useRef(false);
  const reviewable = isMembershipDraftReviewable(draft, catalogue);
  const selectedPlan = membershipDraftPlan(draft, catalogue);
  const selectedGyms = membershipDraftGyms(draft, catalogue);
  const showReview = reviewMode && reviewable;

  useEffect(() => {
    if (!initialPlan || initializedFromQuery.current) return;
    initializedFromQuery.current = true;
    dispatch({ type: "select-plan", planId: initialPlan });
  }, [dispatch, initialPlan]);

  function selectPlan(planId: MembershipPlanId) {
    const outcome = dispatch({ type: "select-plan", planId });
    setReviewMode(false);
    if (outcome.removedGymIds.length) {
      const removedNames = outcome.removedGymIds
        .map(
          (gymId) => studios.find((candidate) => candidate.id === gymId)?.name,
        )
        .filter(Boolean)
        .join(", ");
      setNotice(
        `${removedNames || "A selected gym"} was removed because it is not eligible for ${planId === "basic" ? "Basic" : "Classic"}.`,
      );
      return;
    }
    setNotice(`${planId === "basic" ? "Basic" : "Classic"} selected.`);
  }

  function toggleGym(gymId: string) {
    const outcome = dispatch({ type: "toggle-gym", gymId });
    setReviewMode(false);
    setNotice(issueMessage(outcome.issue));
  }

  function resetDraft() {
    dispatch({ type: "reset" });
    setReviewMode(false);
    setNotice("Draft reset. No membership was created.");
  }

  return (
    <section className="membership-setup" aria-labelledby="membership-title">
      <div className="membership-setup-heading">
        <Link href="/explore" className="back-link">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Explore
        </Link>
        <span className="eyebrow">MEMBERSHIP SETUP · PREVIEW ONLY</span>
        <h1 id="membership-title">
          Build your membership draft<span className="lime-text">.</span>
        </h1>
        <p>
          Choose a plan and exactly four eligible core gyms. This browser-local
          draft does not activate access or request payment.
        </p>
      </div>

      {recovery !== "none" && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          {recovery === "catalogue-changed"
            ? "We updated your draft because gym or plan eligibility changed. Please review your choices."
            : "We could not safely use the saved draft, so the preview was reset."}
        </div>
      )}
      {storageUnavailable && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          Browser storage is unavailable. This draft will last only until the
          page closes.
        </div>
      )}
      {notice && (
        <div className="membership-message" role="status">
          {notice}
        </div>
      )}

      {!showReview ? (
        <>
          <fieldset className="membership-choice-section">
            <legend>
              <span className="membership-step">01</span>
              <span>
                <strong>Choose your plan</strong>
                <small>Illustrative monthly demo pricing</small>
              </span>
            </legend>
            <div className="membership-plan-choices">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`membership-plan-choice ${draft.planId === plan.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="membership-plan"
                    value={plan.id}
                    checked={draft.planId === plan.id}
                    onChange={() => selectPlan(plan.id)}
                  />
                  <span className="membership-choice-check" aria-hidden="true">
                    <Check size={15} />
                  </span>
                  <span className="membership-plan-choice-copy">
                    <span className="membership-plan-choice-topline">
                      <strong>{plan.name}</strong>
                      <b>
                        €{plan.price.amount}
                        <small> / month</small>
                      </b>
                    </span>
                    <span>{accessLabel(plan.id)}</span>
                    <small>
                      Four core gyms · one included check-in per venue-local day
                    </small>
                    <small>
                      Eligible non-core gym visits: €
                      {plan.nonCoreVisitPrice.amount}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="membership-choice-section gym-choice-section">
            <legend>
              <span className="membership-step">02</span>
              <span>
                <strong>Choose four core gyms</strong>
                <small>Your selected set for this concept period</small>
              </span>
              <b className="membership-progress" aria-live="polite">
                {draft.gymIds.length}/{REQUIRED_CORE_GYMS}
              </b>
            </legend>
            {!draft.planId && (
              <p className="membership-field-hint">
                Choose Basic or Classic to see plan eligibility.
              </p>
            )}
            {draft.gymIds.length === REQUIRED_CORE_GYMS && (
              <p className="membership-field-hint complete">
                Your core set is complete. Remove one gym to choose another.
              </p>
            )}
            <div className="membership-gym-choices">
              {studios.map((gym) => {
                const selected = draft.gymIds.includes(gym.id);
                const eligible = draft.planId
                  ? gym.eligiblePlans.includes(draft.planId)
                  : false;
                const selectionFull =
                  draft.gymIds.length >= REQUIRED_CORE_GYMS && !selected;
                const disabled = !draft.planId || !eligible || selectionFull;
                return (
                  <label
                    key={gym.id}
                    className={`membership-gym-choice ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleGym(gym.id)}
                    />
                    <span
                      className="membership-choice-check"
                      aria-hidden="true"
                    >
                      <Check size={15} />
                    </span>
                    <span>
                      <strong>{gym.name}</strong>
                      <small>
                        {gym.area} · {gym.activities.join(" · ")}
                      </small>
                      <em>
                        {!draft.planId
                          ? "Choose a plan first"
                          : eligible
                            ? `${draft.planId === "basic" ? "Basic" : "Classic"} eligible`
                            : `Not eligible for ${draft.planId === "basic" ? "Basic" : "Classic"}`}
                      </em>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="membership-setup-actions">
            <div>
              <strong>
                {reviewable
                  ? "Your draft is ready to review."
                  : `${REQUIRED_CORE_GYMS - draft.gymIds.length} gym${REQUIRED_CORE_GYMS - draft.gymIds.length === 1 ? "" : "s"} still needed.`}
              </strong>
              <small>No membership or payment is created.</small>
            </div>
            <button
              type="button"
              className="button dark"
              disabled={!reviewable}
              onClick={() => setReviewMode(true)}
            >
              Review draft <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <section className="membership-review" aria-labelledby="review-title">
          <div className="membership-review-heading">
            <div>
              <span className="eyebrow">DRAFT SELECTION · NOT ACTIVE</span>
              <h2 id="review-title">Review your membership preview.</h2>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => setReviewMode(false)}
            >
              Edit choices
            </button>
          </div>
          {selectedPlan && (
            <div className="membership-review-plan">
              <div>
                <span>{selectedPlan.name}</span>
                <strong>{accessLabel(selectedPlan.id)}</strong>
              </div>
              <b>
                €{selectedPlan.price.amount}
                <small> / month</small>
              </b>
            </div>
          )}
          <div className="membership-review-gyms">
            {selectedGyms.map((gym, index) => (
              <div key={gym.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>
                  <strong>{gym.name}</strong>
                  <small>
                    {gym.area} · {gym.activities.join(" · ")}
                  </small>
                </p>
              </div>
            ))}
          </div>
          <div className="membership-review-rules">
            <p>
              <Check size={14} aria-hidden="true" /> One included check-in per
              venue-local day
            </p>
            <p>
              <Check size={14} aria-hidden="true" /> Eligible non-core gym
              visits cost an illustrative €15
            </p>
          </div>
          <div className="membership-review-notice">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              <strong>This remains a browser-local draft.</strong>
              Continuing will not activate access, request a wallet transaction
              or create a paid membership.
            </p>
          </div>
          <div className="membership-review-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setReviewMode(false)}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Edit draft
            </button>
            <Link
              href="/coming-soon?source=membership-draft"
              className="button lime"
            >
              Continue to Coming Soon
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {(draft.planId || draft.gymIds.length > 0) && (
        <button
          type="button"
          className="membership-reset text-link"
          onClick={resetDraft}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset draft
        </button>
      )}
    </section>
  );
}
