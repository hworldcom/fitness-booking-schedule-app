import {
  normalizeCoachDirectoryFilters,
  type CoachDirectoryEntry,
  type CoachDirectoryFilters,
} from "@/domain/coaches";

import { marketplaceDiscipline as homeDiscipline } from "./discipline-search-contract";
export {
  marketplaceDiscipline as homeDiscipline,
  DISCIPLINE_SEARCH_PATTERN as HOME_DISCIPLINE_PATTERN,
} from "./discipline-search-contract";

export const HOME_COACH_PAGE_SIZE = 4;
export type HomeSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;
export function normalizeHomeSearch(searchParams: HomeSearchParams) {
  const disciplineValue = Array.isArray(searchParams.discipline)
    ? searchParams.discipline[0]
    : searchParams.discipline;
  const filters = normalizeCoachDirectoryFilters({
    discipline: homeDiscipline(disciplineValue ?? "") ?? undefined,
    location: searchParams.location,
  });
  const pageValue = searchParams.page;
  const candidate =
    typeof pageValue === "string" && /^\d+$/.test(pageValue)
      ? Number(pageValue)
      : 1;
  const page = Number.isSafeInteger(candidate) && candidate > 0 ? candidate : 1;
  return Object.freeze({ filters, page });
}

export function homeDirectoryHref(filters: CoachDirectoryFilters, page = 1) {
  const normalized = normalizeCoachDirectoryFilters({
    discipline: filters.discipline ?? undefined,
    location: filters.location,
  });
  const params = new URLSearchParams();
  if (normalized.discipline) params.set("discipline", normalized.discipline);
  if (normalized.location) params.set("location", normalized.location);
  if (Number.isSafeInteger(page) && page > 1) params.set("page", String(page));
  return params.size ? "/?" + params.toString() : "/";
}

export function isCanonicalHomeSearch(
  searchParams: HomeSearchParams,
  filters: CoachDirectoryFilters,
  page: number,
) {
  const expected = new URL(
    homeDirectoryHref(filters, page),
    "https://home.movx.invalid",
  ).searchParams;
  const keys = Object.keys(searchParams).filter(
    (key) => searchParams[key] !== undefined,
  );
  return (
    keys.length === expected.size &&
    keys.every(
      (key) =>
        typeof searchParams[key] === "string" &&
        searchParams[key] === expected.get(key),
    )
  );
}

export function homeCoachDirectoryPage(
  entries: readonly CoachDirectoryEntry[],
  requestedPage = 1,
) {
  const safePage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const page = Math.min(
    safePage,
    Math.max(1, Math.ceil(entries.length / HOME_COACH_PAGE_SIZE)),
  );
  const visible = Object.freeze(entries.slice(0, page * HOME_COACH_PAGE_SIZE));
  return Object.freeze({
    entries: visible,
    page,
    total: entries.length,
    hasMore: visible.length < entries.length,
  });
}
