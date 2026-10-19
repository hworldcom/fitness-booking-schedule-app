import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";
import { MarketplaceDisciplineNavigation } from "./marketplace-discipline-navigation";

export function PublicMarketplaceSearch({
  filters,
  view = null,
}: {
  filters: CoachDirectoryFilters;
  view?: CoachExploreView | null;
}) {
  const searchFilters = filters;
  const hasActiveFilters = Boolean(
    searchFilters.query || searchFilters.discipline || searchFilters.location,
  );
  const clearHref = coachDirectoryHref(
    searchFilters,
    { query: "", discipline: null, location: "" },
    view,
  );
  return (
    <div
      className="marketplace-search home-marketplace-search explore-marketplace-search"
      key={coachDirectoryHref(searchFilters, {}, view)}
    >
      <Form
        action="/explore"
        id="explore-search-form"
        className="home-coach-search explore-coach-search"
        aria-label="Search coaches"
        scroll={false}
      >
        <label htmlFor="explore-query">
          <span>Search coach or focus</span>
          <input
            id="explore-query"
            type="search"
            name="q"
            defaultValue={searchFilters.query}
            placeholder="Name, fundamentals, footwork…"
            maxLength={80}
          />
        </label>
        {searchFilters.discipline && (
          <input
            type="hidden"
            name="discipline"
            value={searchFilters.discipline}
          />
        )}
        <label htmlFor="explore-location">
          <span>Where in Berlin?</span>
          <input
            id="explore-location"
            type="search"
            name="location"
            defaultValue={searchFilters.location}
            placeholder="Area, gym or public place"
            maxLength={120}
          />
        </label>
        {view && <input type="hidden" name="view" value={view} />}
        <button
          className="button dark"
          type="submit"
          aria-label="Search coaches"
        >
          <Search size={17} aria-hidden="true" /> <span>Search coaches</span>
        </button>
      </Form>
      <MarketplaceDisciplineNavigation
        filters={searchFilters}
        destination="explore"
        view={view}
      />
      {hasActiveFilters && (
        <Link
          className="marketplace-clear-search explore-clear-search"
          href={clearHref}
          scroll={false}
        >
          <X size={14} aria-hidden="true" /> Clear search
        </Link>
      )}
    </div>
  );
}
