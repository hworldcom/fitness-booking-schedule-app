"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ExternalLink,
  Infinity as InfinityIcon,
  MapPin,
  X,
} from "lucide-react";
import type {
  Discipline,
  GymSummary,
  MembershipPlanSummary,
  PublicCatalogue,
  PublicCatalogueResult,
} from "@/domain/catalogue";
import type {
  ActivityFilter,
  AreaFilter,
  PlanFilter,
} from "@/domain/discovery";
import {
  ActivityControl,
  AreaControl,
  PlanControl,
} from "@/components/discovery-filters";
import { Artwork, Empty, Modal, Pill } from "@/components/ui";
import { filterStudios } from "@/features/discovery/filters";
import { previewCatalogue } from "@/features/preview/catalogue";

function PlanCard({ plan }: { plan: MembershipPlanSummary }) {
  const limited = plan.access.model === "limited";
  const accessLabel =
    plan.access.model === "limited"
      ? `${plan.access.includedCheckins} included check-ins`
      : null;
  return (
    <article className={`explore-plan-card ${plan.id}`}>
      <div className="explore-plan-topline">
        <span>{plan.name}</span>
        <strong>
          €{plan.price.amount}
          <small> / {plan.priceInterval}</small>
        </strong>
      </div>
      <h3>
        {limited ? (
          accessLabel
        ) : (
          <>
            <InfinityIcon size={24} aria-hidden="true" /> Unlimited included
            check-ins
          </>
        )}
      </h3>
      <p>{plan.description}</p>
      <ul>
        <li>Choose {plan.requiredCoreGyms} core gyms</li>
        <li>One included check-in per venue-local day</li>
        <li>Eligible non-core visits: €{plan.nonCoreVisitPrice.amount}</li>
      </ul>
      <Link
        href={`/membership/setup?plan=${plan.id}`}
        className="explore-plan-select text-link"
      >
        Preview {plan.name} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}

function eligiblePlanLabel(studio: GymSummary) {
  return studio.eligiblePlans
    .map((plan) => (plan === "basic" ? "Basic" : "Classic"))
    .join(" + ");
}

function StudioCard({
  studio,
  onOpen,
}: {
  studio: GymSummary;
  onOpen: () => void;
}) {
  return (
    <article className="studio-card">
      <button
        className="studio-art"
        onClick={onOpen}
        aria-label={`View ${studio.name}`}
      >
        <Artwork kind={studio.artwork} />
        <span className="art-pill">
          <Pill tone="white">
            <Building2 size={12} aria-hidden="true" />
            Fictional gym
          </Pill>
        </span>
      </button>
      <div className="studio-content">
        <span className="studio-location">
          <MapPin size={13} aria-hidden="true" />
          {studio.area}, Berlin
        </span>
        <h2>{studio.name}</h2>
        <div className="studio-activities">
          {studio.activities.map((activity) => (
            <Pill key={activity}>{activity}</Pill>
          ))}
        </div>
        <p>{studio.description}</p>
        <div className="studio-access-summary">
          <span>{eligiblePlanLabel(studio)} eligible</span>
          <span>
            {studio.supportsNonCoreVisit
              ? "€15 non-core visit"
              : "Core access only"}
          </span>
        </div>
        <button className="text-link studio-link" onClick={onOpen}>
          View gym <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function StudioDetails({
  studio,
  onClose,
}: {
  studio: GymSummary;
  onClose: () => void;
}) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${studio.mapAnchor.latitude},${studio.mapAnchor.longitude}`;
  return (
    <Modal title={studio.name} onClose={onClose}>
      <p className="studio-dialog-location">
        <MapPin size={15} aria-hidden="true" />
        {studio.area}, Berlin <span>· Illustrative gym</span>
      </p>
      <div className="studio-activities">
        {studio.activities.map((activity) => (
          <Pill key={activity} tone="lime">
            {activity}
          </Pill>
        ))}
      </div>
      <p className="dialog-copy">{studio.description}</p>
      <dl className="studio-details-list">
        <div>
          <dt>Membership access</dt>
          <dd>{eligiblePlanLabel(studio)}</dd>
        </div>
        <div>
          <dt>Non-core member visit</dt>
          <dd>
            {studio.supportsNonCoreVisit
              ? "Eligible · illustrative €15"
              : "Not offered in this preview"}
          </dd>
        </div>
        <div>
          <dt>Example coach{studio.coaches.length === 1 ? "" : "es"}</dt>
          <dd>{studio.coaches.join(", ")}</dd>
        </div>
      </dl>
      <div className="map-anchor">
        <span className="eyebrow">ILLUSTRATIVE MAP ANCHOR</span>
        <strong>{studio.mapAnchor.label}</strong>
        <p>{studio.mapAnchor.address}</p>
        <small>
          This public landmark is a map reference only. It is not the fictional
          gym&apos;s address and does not imply an affiliation.
        </small>
        <a href={mapUrl} target="_blank" rel="noreferrer" className="text-link">
          Open map anchor <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      <div className="notice">
        <strong>This is a concept catalogue.</strong>
        <p>
          It does not show live availability, schedules, membership activation
          or a partnership with a real venue.
        </p>
      </div>
    </Modal>
  );
}

function CatalogueState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="catalogue-state" role="status">
      <Empty title={title} description={description} />
      <Link href="/coming-soon" className="button secondary">
        Join the waitlist <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

function ReadyExplore({
  catalogue,
  initialQuery,
}: {
  catalogue: PublicCatalogue;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [area, setArea] = useState<AreaFilter>("all");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [studio, setStudio] = useState<GymSummary | null>(null);
  const activityOptions = useMemo(
    () =>
      Array.from(
        new Set(catalogue.gyms.flatMap((item) => item.activities)),
      ).sort() as Discipline[],
    [catalogue.gyms],
  );
  const areaOptions = useMemo(
    () => Array.from(new Set(catalogue.gyms.map((item) => item.area))).sort(),
    [catalogue.gyms],
  );
  const results = filterStudios(catalogue.gyms, {
    activity,
    area,
    plan,
    query,
  });
  const filtered =
    activity !== "all" || area !== "all" || plan !== "all" || !!query.trim();

  function reset() {
    setActivity("all");
    setArea("all");
    setPlan("all");
    setQuery("");
  }

  return (
    <>
      <div className="page-heading explore-heading">
        <div>
          <span className="eyebrow">
            MULTI-GYM MEMBERSHIP · CONCEPT PREVIEW
          </span>
          <h1>
            Explore participating gyms<span className="lime-text">.</span>
          </h1>
          <p>
            Compare the two demo plans, then explore seven fictional Berlin gyms
            built around different routines.
          </p>
        </div>
        <Pill>
          <MapPin size={14} aria-hidden="true" />
          Berlin
        </Pill>
      </div>

      <section className="explore-plans" aria-labelledby="explore-plans-title">
        <div className="explore-section-heading">
          <div>
            <span className="eyebrow">CHOOSE YOUR RHYTHM</span>
            <h2 id="explore-plans-title">Two plans. One flexible network.</h2>
          </div>
          <p>
            Illustrative monthly pricing. Membership selection and payment are
            not live yet.
          </p>
        </div>
        <div className="explore-plan-grid">
          {catalogue.plans.map((item) => (
            <PlanCard key={item.id} plan={item} />
          ))}
        </div>
        <div className="explore-plan-footer">
          <p>
            Visits beyond your selected core set cost an illustrative €15 at
            participating gyms that offer the member price.
          </p>
          <Link href="/coming-soon" className="button lime">
            Join the waitlist <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {!!query.trim() && (
        <div className="explore-search-context">
          <span>
            Results for <strong>“{query.trim()}”</strong>
          </span>
          <button
            className="text-link"
            aria-label="Clear search"
            onClick={reset}
          >
            Clear search <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="discovery-filters studios-filters">
        <ActivityControl
          id="studio-activity"
          value={activity}
          options={activityOptions}
          onChange={setActivity}
        />
        <AreaControl
          id="studio-area"
          value={area}
          options={areaOptions}
          onChange={setArea}
        />
        <PlanControl id="studio-plan" value={plan} onChange={setPlan} />
        {filtered && (
          <button className="text-link reset-filters" onClick={reset}>
            Reset filters <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="results-label" aria-live="polite">
        <strong>
          {results.length} {results.length === 1 ? "gym" : "gyms"} in this
          concept preview
        </strong>
        <span>Fictional businesses · No live availability</span>
      </div>

      <div className="studio-grid">
        {results.map((item) => (
          <StudioCard
            key={item.id}
            studio={item}
            onOpen={() => setStudio(item)}
          />
        ))}
      </div>

      {!results.length && (
        <div className="discovery-empty">
          <Empty
            title="No gyms match those filters yet."
            description="Reset the concept catalogue to see every fictional gym."
          />
          <button className="button secondary" onClick={reset}>
            Show all gyms <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="catalogue-note">
        Preview fixtures only. Public map anchors are not gym addresses and no
        venue partnership is claimed.
      </p>

      {studio && (
        <StudioDetails studio={studio} onClose={() => setStudio(null)} />
      )}
    </>
  );
}

export function Explore({
  initialQuery = "",
  catalogueResult = previewCatalogue,
}: {
  initialQuery?: string;
  catalogueResult?: PublicCatalogueResult;
}) {
  if (catalogueResult.status === "loading") {
    return (
      <CatalogueState
        title="Loading the gym preview…"
        description="The fictional catalogue is being prepared."
      />
    );
  }
  if (catalogueResult.status === "error") {
    return (
      <CatalogueState
        title="The gym preview is unavailable."
        description={catalogueResult.message}
      />
    );
  }
  if (catalogueResult.status === "empty") {
    return (
      <CatalogueState
        title="No preview gyms are available yet."
        description="Join the waitlist while the fictional catalogue is prepared."
      />
    );
  }

  return (
    <ReadyExplore
      catalogue={catalogueResult.catalogue}
      initialQuery={initialQuery}
    />
  );
}
