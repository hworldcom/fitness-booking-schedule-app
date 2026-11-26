"use client";

import Form from "next/form";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  coachDirectoryDisciplines,
  type CoachDirectoryFilters,
} from "@/domain/coaches";
import {
  coachDirectoryHref,
  normalizeCoachExploreFilters,
  canonicalCoachExploreView,
  type CoachExploreView,
} from "./marketplace-search-contract";
import { ExploreCategoryFilter } from "./explore-category-filter";

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
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const element = form.current;
    if (!element) return;
    // Native GET and Next Form both consume FormData. Omit empty controls and
    // normalize values here to avoid a redirect that resets the visit's origin.
    const canonicalize = (event: FormDataEvent) => {
      const data = event.formData;
      const raw = {
        q: String(data.get("q") ?? ""),
        discipline: data.getAll("discipline").map(String),
        location: String(data.get("location") ?? ""),
        session: String(data.get("session") ?? ""),
        saved: String(data.get("saved") ?? ""),
        view: String(data.get("view") ?? ""),
      };
      const canonical = new URL(
        coachDirectoryHref(
          normalizeCoachExploreFilters(raw),
          {},
          canonicalCoachExploreView(raw),
        ),
        window.location.origin,
      ).searchParams;
      for (const key of Object.keys(raw)) data.delete(key);
      for (const [key, value] of canonical) data.append(key, value);
    };
    element.addEventListener("formdata", canonicalize);
    return () => element.removeEventListener("formdata", canonicalize);
  }, [searchFilters]);
  const hasActiveFilters = Boolean(
    searchFilters.query ||
    coachDirectoryDisciplines(searchFilters).length ||
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
        ref={form}
        action="/explore"
        id="explore-search-form"
        className="explore-search-form"
        aria-label="Search coaches"
        scroll={false}
        key={coachDirectoryHref(searchFilters, { savedOnly: false })}
        onSubmit={(event) => {
          for (const details of event.currentTarget.querySelectorAll("details"))
            details.open = false;
          onSearch?.();
        }}
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
          <ExploreCategoryFilter
            initialSelection={coachDirectoryDisciplines(searchFilters)}
          />
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
