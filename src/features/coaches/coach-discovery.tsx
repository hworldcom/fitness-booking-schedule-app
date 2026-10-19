import Link from "next/link";
import { Search, UserRoundSearch } from "lucide-react";
import { MarketplaceHero } from "@/features/public/marketplace-hero";
import { type CoachDirectoryState } from "@/domain/coaches";
import { CoachExploreResults } from "./coach-explore-results";
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
      <MarketplaceHero
        image="/images/explore-training.jpg"
        alt="Two athletes greeting each other beside training sleds and ropes."
        titleId="explore-hero-title"
        className="marketplace-explore-hero"
      >
        <span>Find your discipline.</span> <span>Meet your coach.</span>
      </MarketplaceHero>
      <PublicMarketplaceSearch filters={state.filters} view={searchView} />
      <div className="explore-directory-content">
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
    </div>
  );
}

export { PublicCoachWebsite as CoachProfileView } from "./website/public-coach-website";

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
