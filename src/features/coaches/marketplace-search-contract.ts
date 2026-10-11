import {
  normalizeCoachDirectoryFilters,
  type CoachDirectoryFilters,
  type CoachDiscipline,
} from "@/domain/coaches";

export type CoachDirectoryFilterOverrides = Readonly<{
  query?: string;
  discipline?: CoachDiscipline | null;
  location?: string;
}>;

type CoachDirectorySearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export function coachDirectoryHref(
  filters: CoachDirectoryFilters,
  overrides: CoachDirectoryFilterOverrides = {},
) {
  const normalized = normalizeCoachDirectoryFilters({
    q: overrides.query ?? filters.query,
    discipline:
      overrides.discipline === undefined
        ? (filters.discipline ?? undefined)
        : (overrides.discipline ?? undefined),
    location: overrides.location ?? filters.location,
  });
  const searchParams = new URLSearchParams();
  if (normalized.query) searchParams.set("q", normalized.query);
  if (normalized.discipline) {
    searchParams.set("discipline", normalized.discipline);
  }
  if (normalized.location) searchParams.set("location", normalized.location);
  const query = searchParams.toString();
  return query ? `/explore?${query}` : "/explore";
}

export function isCanonicalCoachDirectorySearch(
  searchParams: CoachDirectorySearchParams,
  filters: CoachDirectoryFilters,
) {
  const expected = new URL(
    coachDirectoryHref(filters),
    "https://search.movx.invalid",
  ).searchParams;
  const actualKeys = Object.keys(searchParams).filter(
    (key) => searchParams[key] !== undefined,
  );
  if (actualKeys.length !== expected.size) return false;
  return actualKeys.every((key) => {
    const value = searchParams[key];
    return typeof value === "string" && expected.get(key) === value;
  });
}
