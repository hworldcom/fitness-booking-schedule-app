import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";
import { MarketplaceDisciplineInput } from "./marketplace-discipline-input";
import { MarketplaceDisciplineNavigation } from "./marketplace-discipline-navigation";

export function PublicMarketplaceSearch({
  filters,
  includeQuery = true,
  view = null,
}: {
  filters: CoachDirectoryFilters;
  includeQuery?: boolean;
  view?: CoachExploreView | null;
}) {
  const searchFilters = includeQuery ? filters : { ...filters, query: "" };
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
      className="marketplace-search explore-marketplace-search"
      key={coachDirectoryHref(searchFilters, {}, view)}
    >
      <Form
        action="/explore"
        className={`home-coach-search explore-coach-search${includeQuery ? " has-query" : ""}`}
        aria-label="Search coaches"
        scroll={false}
      >
        {includeQuery && (
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
        )}
        <label htmlFor="explore-discipline">
          <span>Discipline</span>
          <MarketplaceDisciplineInput
            discipline={searchFilters.discipline}
            prefix="explore"
          />
        </label>
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
        <button className="button dark" type="submit">
          <Search size={17} aria-hidden="true" /> Search coaches
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
