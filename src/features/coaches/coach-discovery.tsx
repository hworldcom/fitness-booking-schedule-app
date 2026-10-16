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
  type CoachDirectoryState,
  type PublicCoachProfileState,
} from "@/domain/coaches";
import { CoachExploreResults } from "./coach-explore-results";
import { CoachProfileLocations } from "./coach-profile-locations";
import { PublicMarketplaceSearch } from "./public-marketplace-search";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";

export function CoachDirectory({
  state,
  view = "list",
  searchView = null,
}: {
  state: CoachDirectoryState;
  view?: CoachExploreView;
  searchView?: CoachExploreView | null;
}) {
  return (
    <div className="coach-discovery">
      <header className="coach-directory-heading">
        <div>
          <span className="eyebrow">PRIVATE MARTIAL-ARTS COACHING</span>
          <h1>Explore coaches in Berlin.</h1>
          <p>
            Find your discipline. Discover a training place. Meet your coach.
          </p>
        </div>
        <Link className="coach-back-link" href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Home
        </Link>
      </header>
      <PublicMarketplaceSearch filters={state.filters} view={searchView} />

      {state.status === "unavailable" ? (
        <section className="coach-directory-state" role="alert">
          <UserRoundSearch size={29} aria-hidden="true" />
          <h2>Coach discovery is temporarily unavailable.</h2>
          <p>
            Coach profiles could not be loaded. Please try your search again.
          </p>
          <Link
            className="button secondary"
            href={coachDirectoryHref(state.filters, {}, searchView)}
          >
            Try again
          </Link>
        </section>
      ) : state.entries.length === 0 ? (
        <section className="coach-directory-state">
          <Search size={29} aria-hidden="true" />
          <h2>No coaches match these filters.</h2>
          <p>
            Try another discipline or clear your filters to see all coaches.
          </p>
          <Link
            className="button secondary"
            href={coachDirectoryHref(
              state.filters,
              { query: "", discipline: null, location: "" },
              searchView,
            )}
          >
            Clear filters
          </Link>
        </section>
      ) : (
        <CoachExploreResults
          entries={state.entries}
          filters={state.filters}
          view={view}
        />
      )}
    </div>
  );
}

export function CoachProfileView({
  state,
  marketplace,
}: {
  state: Omit<
    Extract<PublicCoachProfileState, { status: "ready" }>,
    "databaseTime"
  >;
  marketplace: ReactNode;
}) {
  const { coach } = state;
  const activeLocations = coach.locations.filter(
    (location) => location.status === "active",
  );
  const primaryLocation = activeLocations.find(
    (location) => location.isPrimary,
  );
  return (
    <article className="public-coach-profile">
      <Link className="coach-back-link" href="/explore">
        <ArrowLeft size={16} aria-hidden="true" /> Back to coaches
      </Link>
      <header className="public-coach-header">
        <div className="public-coach-identity">
          <Avatar
            initials={profileInitials(coach.displayName)}
            imageUrl={coach.portraitUrl}
            alt={
              coach.portraitUrl ? `${coach.displayName}'s coach portrait` : ""
            }
          />
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
            <small>PRIMARY TRAINING BASE · NOT LIVE</small>
            <strong>
              {primaryLocation?.publicName ??
                coach.gymName ??
                "Independent training place"}
            </strong>
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
          <CoachProfileLocations
            coachName={coach.displayName}
            locations={activeLocations}
          />
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
