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

export const HOME_COACH_PREVIEW_SIZE = 4;
export type HomeSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;
export function normalizeHomeSearch(searchParams: HomeSearchParams) {
  const disciplineValue = Array.isArray(searchParams.discipline)
    ? searchParams.discipline[0]
    : searchParams.discipline;
  const filters = normalizeCoachDirectoryFilters({
    discipline: homeDiscipline(disciplineValue ?? "") ?? undefined,
  });
  return Object.freeze({ filters });
}

export function homeDirectoryHref(filters: CoachDirectoryFilters) {
  const normalized = normalizeCoachDirectoryFilters({
    discipline: filters.discipline ?? undefined,
  });
  const params = new URLSearchParams();
  if (normalized.discipline) params.set("discipline", normalized.discipline);
  return params.size ? "/?" + params.toString() : "/";
}

export function isCanonicalHomeSearch(
  searchParams: HomeSearchParams,
  filters: CoachDirectoryFilters,
) {
  const expected = new URL(
    homeDirectoryHref(filters),
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

export function homeCoachDirectoryPreview(
  entries: readonly CoachDirectoryEntry[],
) {
  const visible = Object.freeze(entries.slice(0, HOME_COACH_PREVIEW_SIZE));
  return Object.freeze({
    entries: visible,
    total: entries.length,
  });
}
