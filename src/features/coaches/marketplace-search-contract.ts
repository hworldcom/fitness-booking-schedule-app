import {
  normalizeCoachDirectoryFilters,
  COACH_DISCIPLINES,
  coachDirectoryDisciplines,
  type CoachDirectoryFilters,
  type CoachDiscipline,
} from "@/domain/coaches";

import { marketplaceDiscipline } from "./discipline-search-contract";

function normalizedDisciplines(values: readonly string[]) {
  const selected = new Set(values.map(marketplaceDiscipline));
  return COACH_DISCIPLINES.filter((discipline) => selected.has(discipline));
}

export function normalizeCoachExploreFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
) {
  const raw = searchParams.discipline;
  const selected = normalizedDisciplines(
    Array.isArray(raw) ? raw : raw ? [raw] : [],
  );
  const filters = normalizeCoachDirectoryFilters({
    ...searchParams,
    discipline: selected.length === 1 ? selected[0] : undefined,
  });
  return Object.freeze({
    ...filters,
    ...(selected.length > 1 ? { disciplines: Object.freeze(selected) } : {}),
    ...(searchParams.session === "private" || searchParams.session === "group"
      ? { sessionFormat: searchParams.session }
      : {}),
    ...(searchParams.saved === "1" ? { savedOnly: true } : {}),
  });
}

export type CoachDirectoryFilterOverrides = Readonly<{
  query?: string;
  discipline?: CoachDiscipline | null;
  disciplines?: readonly CoachDiscipline[];
  location?: string;
  sessionFormat?: "private" | "group" | null;
  savedOnly?: boolean;
}>;

export type CoachExploreView = "list" | "map";

type CoachDirectorySearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export function coachDirectoryHref(
  filters: CoachDirectoryFilters,
  overrides: CoachDirectoryFilterOverrides = {},
  view: CoachExploreView | null = null,
) {
  const selected = normalizedDisciplines(
    overrides.disciplines ??
      (overrides.discipline !== undefined
        ? overrides.discipline
          ? [overrides.discipline]
          : []
        : coachDirectoryDisciplines(filters)),
  );
  const normalized = normalizeCoachDirectoryFilters({
    q: overrides.query ?? filters.query,
    discipline: selected.length === 1 ? selected[0] : undefined,
    location: overrides.location ?? filters.location,
  });
  const searchParams = new URLSearchParams();
  if (normalized.query) searchParams.set("q", normalized.query);
  for (const discipline of selected)
    searchParams.append("discipline", discipline);
  if (normalized.location) searchParams.set("location", normalized.location);
  const format =
    overrides.sessionFormat === undefined
      ? filters.sessionFormat
      : overrides.sessionFormat;
  if (format === "private" || format === "group")
    searchParams.set("session", format);
  if (overrides.savedOnly ?? filters.savedOnly) searchParams.set("saved", "1");
  if (view) searchParams.set("view", view);
  const query = searchParams.toString();
  return query ? `/explore?${query}` : "/explore";
}

export function canonicalCoachExploreView(
  searchParams: CoachDirectorySearchParams,
): CoachExploreView | null {
  return searchParams.view === "list" || searchParams.view === "map"
    ? searchParams.view
    : null;
}

export function normalizeCoachExploreView(
  searchParams: CoachDirectorySearchParams,
): CoachExploreView {
  return canonicalCoachExploreView(searchParams) ?? "list";
}

export function isCanonicalCoachDirectorySearch(
  searchParams: CoachDirectorySearchParams,
  filters: CoachDirectoryFilters,
  view: CoachExploreView | null = null,
) {
  const expected = new URL(
    coachDirectoryHref(filters, {}, view),
    "https://search.movx.invalid",
  ).searchParams;
  const actualKeys = Object.keys(searchParams).filter(
    (key) => searchParams[key] !== undefined,
  );
  if (actualKeys.length !== new Set(expected.keys()).size) return false;
  return actualKeys.every((key) => {
    const value = searchParams[key];
    if (key === "discipline") {
      const actual = Array.isArray(value) ? value : [value];
      const wanted = expected.getAll(key);
      return (
        actual.length === wanted.length &&
        actual.every((item, index) => item === wanted[index])
      );
    }
    return typeof value === "string" && expected.get(key) === value;
  });
}
