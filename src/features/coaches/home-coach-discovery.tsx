import Link from "next/link";
import { ArrowRight, SearchX, UserRoundSearch } from "lucide-react";
import type { CoachDirectoryState } from "@/domain/coaches";
import { CompactCoachCard } from "./compact-coach-card";
import {
  homeCoachDirectoryPage,
  homeDirectoryHref,
} from "./home-marketplace-contract";
import { HomeLoadMore } from "./home-load-more";

export function HomeCoachDiscovery({
  state,
  page = 1,
}: {
  state: CoachDirectoryState;
  page?: number;
}) {
  const result = homeCoachDirectoryPage(
    state.status === "ready" ? state.entries : [],
    page,
  );
  const filtered = Boolean(state.filters.discipline || state.filters.location);
  return (
    <section
      className="home-coach-discovery"
      aria-labelledby="home-coach-discovery-title"
    >
      <div className="home-coach-discovery-heading">
        <div>
          <h2 id="home-coach-discovery-title">Discover coaches in Berlin</h2>
          {state.status === "ready" && (
            <p className="home-coach-discovery-summary" role="status">
              {state.filters.discipline ?? "All disciplines"} · Showing{" "}
              {result.entries.length} of {result.total} coach
              {result.total === 1 ? "" : "es"}
              {state.filters.location ? " · " + state.filters.location : ""}
            </p>
          )}
        </div>
        {filtered ? (
          <Link className="text-link" href="/" prefetch={false}>
            Clear filters
          </Link>
        ) : (
          <Link
            className="text-link"
            href="/explore?view=map"
            aria-label="Explore with a map"
          >
            <span className="home-map-link-wide">Explore with a map</span>
            <span className="home-map-link-short" aria-hidden="true">
              Map
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {state.status === "unavailable" ? (
        <div className="home-coach-discovery-state" role="alert">
          <UserRoundSearch size={27} aria-hidden="true" />
          <div>
            <h3>Coach discovery is temporarily unavailable.</h3>
            <p>
              Coach profiles could not be loaded. Please try your search again.
            </p>
          </div>
          <a
            className="button secondary"
            href={homeDirectoryHref(state.filters)}
          >
            Try again
          </a>
        </div>
      ) : result.total === 0 ? (
        <div className="home-coach-discovery-state">
          <SearchX size={27} aria-hidden="true" />
          <div>
            <h3>
              {filtered
                ? "No coaches match these filters."
                : "No public coaches yet."}
            </h3>
            <p>
              {filtered
                ? "Try another discipline or training place."
                : "There are no visible coach profiles to show right now."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div id="home-coach-grid" className="home-coach-grid">
            {result.entries.map((entry) => (
              <CompactCoachCard
                entry={entry}
                variant="marketplace"
                key={entry.coach.profileId}
              />
            ))}
          </div>
          <HomeLoadMore
            filters={state.filters}
            page={result.page}
            hasMore={result.hasMore}
            key={homeDirectoryHref(state.filters)}
          />
        </>
      )}
    </section>
  );
}
