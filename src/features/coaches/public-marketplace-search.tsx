"use client";

import Form from "next/form";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  COACH_DISCIPLINES,
  type CoachDirectoryFilters,
} from "@/domain/coaches";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";

export function PublicMarketplaceSearch({
  filters,
  view = null,
  children,
  onSearch,
}: {
  filters: CoachDirectoryFilters;
  view?: CoachExploreView | null;
  children?: ReactNode;
  onSearch?: () => void;
}) {
  const searchFilters = filters;
  const hasActiveFilters = Boolean(
    searchFilters.query ||
    searchFilters.discipline ||
    searchFilters.location ||
    searchFilters.sessionFormat ||
    searchFilters.savedOnly,
  );
  const clearHref = coachDirectoryHref(
    searchFilters,
    {
      query: "",
      discipline: null,
      location: "",
      sessionFormat: null,
      savedOnly: false,
    },
    view,
  );
  return (
    <div className="explore-search-toolbar">
      <Form
        action="/explore"
        id="explore-search-form"
        className="explore-search-form"
        aria-label="Search coaches"
        scroll={false}
        key={coachDirectoryHref(searchFilters, { savedOnly: false })}
        onSubmit={onSearch}
      >
        <div className="explore-search-row">
          <label htmlFor="explore-query" className="explore-search-input">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search coach or focus</span>
            <input
              id="explore-query"
              type="search"
              name="q"
              defaultValue={searchFilters.query}
              placeholder="Coach or training focus"
              maxLength={80}
            />
          </label>
          <button
            className="button dark explore-submit-search"
            type="submit"
            aria-label="Search coaches"
          >
            <Search size={17} aria-hidden="true" /> <span>Search</span>
          </button>
        </div>
        <div className="explore-filter-row">
          {children}
          <label className="explore-select-filter">
            <span className="sr-only">Categories</span>
            <select
              name="discipline"
              aria-label="Categories"
              defaultValue={searchFilters.discipline ?? ""}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <option value="">Categories</option>
              {COACH_DISCIPLINES.map((discipline) => (
                <option key={discipline} value={discipline}>
                  {discipline}
                </option>
              ))}
            </select>
          </label>
          <label className="explore-select-filter">
            <span className="sr-only">Session type</span>
            <select
              name="session"
              aria-label="Session type"
              defaultValue={searchFilters.sessionFormat ?? ""}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <option value="">Sessions</option>
              <option value="private">Private</option>
              <option value="group">Group</option>
            </select>
          </label>
          <details className="explore-location-filter">
            <summary>
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span>Location</span>
              {searchFilters.location && (
                <span
                  className="explore-filter-dot"
                  aria-label="Location filter active"
                />
              )}
            </summary>
            <div>
              <label htmlFor="explore-location">
                Where in Berlin?
                <input
                  id="explore-location"
                  type="search"
                  name="location"
                  defaultValue={searchFilters.location}
                  placeholder="Area, gym or training place"
                  maxLength={120}
                />
              </label>
              <button type="submit">Apply location</button>
            </div>
          </details>
          {view && <input type="hidden" name="view" value={view} />}
          {searchFilters.savedOnly && (
            <input type="hidden" name="saved" value="1" />
          )}
          {hasActiveFilters && (
            <Link
              className="explore-clear-search"
              href={clearHref}
              scroll={false}
            >
              <X size={15} aria-hidden="true" />
              Clear search
            </Link>
          )}
        </div>
      </Form>
    </div>
  );
}
