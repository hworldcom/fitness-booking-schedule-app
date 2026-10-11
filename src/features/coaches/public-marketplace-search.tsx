import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  COACH_DISCIPLINES,
  type CoachDirectoryFilters,
} from "@/domain/coaches";
import { coachDirectoryHref } from "./marketplace-search-contract";

export function PublicMarketplaceSearch({
  filters,
}: {
  filters: CoachDirectoryFilters;
}) {
  const hasActiveFilters = Boolean(
    filters.query || filters.discipline || filters.location,
  );

  return (
    <div className="marketplace-search" key={coachDirectoryHref(filters)}>
      <form
        className="coach-filters"
        action="/explore"
        method="get"
        aria-label="Search coaches"
      >
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
        <button className="button dark" type="submit">
          <Search size={16} aria-hidden="true" /> Search coaches
        </button>
      </form>

      <nav
        className="marketplace-discipline-navigation"
        aria-label="Browse coaches by discipline"
      >
        <span>Browse by discipline</span>
        <div className="marketplace-discipline-chips">
          <Link
            className={`marketplace-discipline-chip ${
              filters.discipline === null ? "active" : ""
            }`}
            href={coachDirectoryHref(filters, { discipline: null })}
            aria-current={filters.discipline === null ? "page" : undefined}
          >
            All
          </Link>
          {COACH_DISCIPLINES.map((discipline) => {
            const selected = filters.discipline === discipline;
            return (
              <Link
                className={`marketplace-discipline-chip ${
                  selected ? "active" : ""
                }`}
                href={coachDirectoryHref(filters, { discipline })}
                aria-current={selected ? "page" : undefined}
                key={discipline}
              >
                {discipline}
              </Link>
            );
          })}
        </div>
        {hasActiveFilters && (
          <Link className="marketplace-clear-search" href="/explore">
            <X size={14} aria-hidden="true" /> Clear search
          </Link>
        )}
      </nav>
    </div>
  );
}
