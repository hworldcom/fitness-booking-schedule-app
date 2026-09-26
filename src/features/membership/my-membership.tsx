"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Dumbbell,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Empty } from "@/components/ui";
import type {
  PublicCatalogue,
  PublicCatalogueResult,
} from "@/domain/catalogue";
import {
  isMembershipDraftReviewable,
  membershipDraftGyms,
  membershipDraftPlan,
  REQUIRED_CORE_GYMS,
} from "@/domain/membership-draft";
import { useMembershipDraft } from "@/features/membership/draft-store";

function ReadyMyAccess({
  preview,
  catalogue,
}: {
  preview: boolean;
  catalogue: PublicCatalogue;
}) {
  const { draft, recovery, storageUnavailable, dispatch } =
    useMembershipDraft(catalogue);
  const plan = membershipDraftPlan(draft, catalogue);
  const gyms = membershipDraftGyms(draft, catalogue);
  const complete = isMembershipDraftReviewable(draft, catalogue);
  const hasDraft = Boolean(plan || gyms.length);

  return (
    <section className="my-access" aria-labelledby="my-access-title">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MY MEMBERSHIP · PREVIEW</span>
          <h1 id="my-access-title">
            Your membership draft<span className="lime-text">.</span>
          </h1>
          <p>
            Review or continue the choices saved in this browser. Drafts are not
            active memberships and do not provide gym access.
          </p>
        </div>
      </div>

      {recovery !== "none" && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          Your saved draft could not be used as-is and was safely updated or
          reset. Please review it before continuing.
        </div>
      )}
      {storageUnavailable && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          Browser storage is unavailable. Draft changes will last only until
          this page closes.
        </div>
      )}

      {hasDraft ? (
        <article className="membership-draft-card">
          <div className="membership-draft-status">
            <span className="eyebrow">DRAFT SELECTION</span>
            <strong>Not active</strong>
          </div>
          <div className="membership-draft-plan">
            <div>
              <span>Selected plan</span>
              <h2>{plan?.name ?? "Choose a plan"}</h2>
              <p>
                {plan
                  ? plan.access.model === "limited"
                    ? `${plan.access.includedCheckins} included check-ins · €${plan.price.amount} / month`
                    : `Unlimited included check-ins · €${plan.price.amount} / month`
                  : "Return to setup to choose Basic or Classic."}
              </p>
            </div>
            <span
              className={`draft-completeness ${complete ? "complete" : ""}`}
            >
              {gyms.length}/{REQUIRED_CORE_GYMS} gyms
            </span>
          </div>
          <div className="membership-draft-gyms">
            {gyms.length ? (
              gyms.map((gym, index) => (
                <div key={gym.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>
                    <strong>{gym.name}</strong>
                    <small>
                      {gym.area} · {gym.activities.join(" · ")}
                    </small>
                  </p>
                </div>
              ))
            ) : (
              <p className="membership-draft-empty-gyms">
                No core gyms selected yet.
              </p>
            )}
          </div>
          {plan && (
            <div className="membership-review-rules membership-draft-rules">
              <p>One included check-in per venue-local day</p>
              <p>
                Eligible non-core gym visits cost an illustrative €
                {plan.nonCoreVisitPrice.amount}
              </p>
            </div>
          )}
          <div className="membership-draft-disclaimer">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              <strong>No payment or access exists.</strong>
              This browser-local draft has no entitlement, check-in balance or
              ownership status.
            </p>
          </div>
          <div className="access-actions">
            <Link href="/membership/setup" className="button dark">
              <Pencil size={16} aria-hidden="true" />
              {complete ? "Edit draft" : "Continue setup"}
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => dispatch({ type: "reset" })}
            >
              <RotateCcw size={15} aria-hidden="true" /> Reset draft
            </button>
          </div>
        </article>
      ) : (
        <div className="access-empty-card">
          <span className="eyebrow">
            {preview ? "PREVIEW STATE" : "EMPTY STATE"}
          </span>
          <h2>No membership draft yet.</h2>
          <p>
            {preview
              ? "Build a browser-local preview by choosing a plan and four gyms. This will not create paid access."
              : "This account has no active MovX membership or saved browser-local draft."}
          </p>
          <div className="access-kind-grid">
            <div className="access-kind">
              <Dumbbell size={22} strokeWidth={1.5} aria-hidden="true" />
              <h3>Multi-gym membership preview</h3>
              <p>Choose Basic or Classic and exactly four core gyms.</p>
            </div>
          </div>
          <div className="access-actions">
            <Link href="/membership/setup" className="button dark">
              Start a draft <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/explore" className="button secondary">
              Explore gyms
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export function MyAccess({
  preview,
  catalogueResult,
}: {
  preview: boolean;
  catalogueResult: PublicCatalogueResult;
}) {
  if (catalogueResult.status === "ready") {
    return (
      <ReadyMyAccess preview={preview} catalogue={catalogueResult.catalogue} />
    );
  }

  const state =
    catalogueResult.status === "error"
      ? {
          title: "Your membership draft is temporarily unavailable.",
          description: catalogueResult.message,
        }
      : catalogueResult.status === "empty"
        ? {
            title: "No membership plans are available yet.",
            description:
              "Your saved draft is unchanged. Join the waitlist while the fictional catalogue is prepared.",
          }
        : {
            title: "Loading your membership draft…",
            description:
              "The fictional membership catalogue is being prepared.",
          };

  return (
    <section className="my-access" aria-labelledby="my-access-title">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MY MEMBERSHIP · PREVIEW</span>
          <h1 id="my-access-title">
            Your membership draft<span className="lime-text">.</span>
          </h1>
        </div>
      </div>
      <div className="catalogue-state" role="status">
        <Empty title={state.title} description={state.description} />
        {catalogueResult.status !== "loading" && (
          <Link href="/coming-soon" className="button secondary">
            Join the waitlist <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
