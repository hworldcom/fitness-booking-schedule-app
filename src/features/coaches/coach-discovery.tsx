import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import type { ReactNode } from "react";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";
import {
  COACH_DISCIPLINES,
  type CoachDirectoryFilters,
  type CoachDirectoryState,
  type PublicCoachProfileState,
} from "@/domain/coaches";
import type { MapboxBrowserConfiguration } from "@/mapbox/provider";
import { CoachExploreResults } from "./coach-explore-results";

export function CoachDirectory({
  state,
  mapboxConfiguration,
}: {
  state: CoachDirectoryState;
  mapboxConfiguration: MapboxBrowserConfiguration;
}) {
  return (
    <div className="coach-discovery">
      <header className="coach-directory-hero">
        <div>
          <span className="eyebrow">APPROVED + DEMO COACHES · BERLIN</span>
          <h1>
            Find a coach and a time that fits
            <span className="lime-text">.</span>
          </h1>
          <p>
            Compare disciplines, coach-confirmed places and real published
            availability. The list remains usable when the optional map is
            unavailable.
          </p>
        </div>
        <div className="coach-directory-disclosure">
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <strong>Scheduling preview</strong>
            <span>
              Fictional coaches and places; database-backed open times.
            </span>
          </div>
        </div>
      </header>

      <CoachFilters filters={state.filters} />

      {state.status === "unavailable" ? (
        <section className="coach-directory-state" role="alert">
          <UserRoundSearch size={29} aria-hidden="true" />
          <h2>Coach discovery is temporarily unavailable.</h2>
          <p>No fixture fallback or invented availability was shown.</p>
          <Link className="button secondary" href="/explore">
            Try again
          </Link>
        </section>
      ) : state.coaches.length === 0 ? (
        <section className="coach-directory-state">
          <Search size={29} aria-hidden="true" />
          <h2>No coaches match these filters.</h2>
          <p>Clear the filters to see every visible demonstration profile.</p>
          <Link className="button secondary" href="/explore">
            Clear filters
          </Link>
        </section>
      ) : (
        <CoachExploreResults
          coaches={state.coaches}
          mapboxConfiguration={mapboxConfiguration}
        />
      )}
    </div>
  );
}

function CoachFilters({ filters }: { filters: CoachDirectoryFilters }) {
  return (
    <form className="coach-filters" action="/explore" method="get">
      <label>
        <span>Search coach or focus</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder="Try fundamentals or footwork"
          maxLength={80}
        />
      </label>
      <label>
        <span>Discipline</span>
        <select name="discipline" defaultValue={filters.discipline ?? ""}>
          <option value="">All disciplines</option>
          {COACH_DISCIPLINES.map((discipline) => (
            <option key={discipline} value={discipline}>
              {discipline}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Location</span>
        <input
          type="search"
          name="location"
          defaultValue={filters.location}
          placeholder="Gym or public place"
          maxLength={120}
        />
      </label>
      <input type="hidden" name="service" value="private-training" />
      <button className="button dark" type="submit">
        <Search size={16} aria-hidden="true" /> Apply filters
      </button>
    </form>
  );
}

export function CoachProfileView({
  state,
  marketplace,
}: {
  state: Extract<PublicCoachProfileState, { status: "ready" }>;
  marketplace: ReactNode;
}) {
  const { coach } = state;
  return (
    <article className="public-coach-profile">
      <Link className="coach-back-link" href="/explore">
        <ArrowLeft size={16} aria-hidden="true" /> Back to coaches
      </Link>
      <header className="public-coach-header">
        <div className="public-coach-identity">
          <Avatar initials={profileInitials(coach.displayName)} />
          <div>
            <span className="eyebrow">
              {coach.trustKind === "verified"
                ? "MOVX-REVIEWED COACH"
                : "FICTIONAL DEMO COACH"}
            </span>
            <h1>{coach.displayName}</h1>
            <p className="coach-trust-label">
              {coach.trustKind === "verified" ? (
                <>
                  <BadgeCheck size={16} aria-hidden="true" /> Verified coach —
                  MovX reviewed this coach&apos;s identity and application.
                </>
              ) : (
                "Demo coach — this fictional profile is not a verified professional."
              )}
            </p>
            <div className="coach-discipline-list">
              {coach.disciplines.map((discipline) => (
                <span key={discipline}>{discipline}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="public-coach-place">
          <MapPin size={23} aria-hidden="true" />
          <div>
            <small>COACH-CONFIRMED PUBLIC PLACE</small>
            <strong>{coach.gymName ?? "Independent training place"}</strong>
            <span>{coach.location.label}</span>
          </div>
        </div>
      </header>
      <div className="public-coach-content">
        <section className="public-coach-about">
          <span className="eyebrow">ABOUT THE COACH</span>
          <h2>Training with {coach.displayName}</h2>
          <p>{coach.bio}</p>
          <div className="coach-location-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              {coach.trustKind === "verified"
                ? "MovX verification covers identity and application review only. It does not guarantee licensing, competence, safety or presence at this place."
                : "This fictional profile uses a public discovery point—not live tracking, current presence or a gym endorsement."}
            </p>
          </div>
        </section>
        {marketplace}
      </div>
    </article>
  );
}

export function CoachProfileUnavailable() {
  return (
    <section className="coach-directory-state" role="alert">
      <UserRoundSearch size={29} aria-hidden="true" />
      <h1>We couldn’t verify this coach profile.</h1>
      <p>No cached or fixture profile was substituted for unavailable data.</p>
      <Link className="button secondary" href="/explore">
        Return to coach discovery
      </Link>
    </section>
  );
}
