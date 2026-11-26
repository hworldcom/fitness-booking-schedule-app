import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
import {
  canonicalCoachExploreView,
  coachDirectoryHref,
  isCanonicalCoachDirectorySearch,
  normalizeCoachExploreView,
  normalizeCoachExploreFilters,
} from "@/features/coaches/marketplace-search-contract";
import { publicCoachDirectory } from "@/server/coaches/service";
import { resolveLocationSearchConfiguration } from "@/location";

export const metadata: Metadata = {
  title: "Explore coaches",
  description:
    "Browse martial-arts and fitness coaches by discipline and coach-confirmed public training place.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearchParams = await searchParams;
  const filters = normalizeCoachExploreFilters(rawSearchParams);
  const explicitView = canonicalCoachExploreView(rawSearchParams);
  if (
    !isCanonicalCoachDirectorySearch(rawSearchParams, filters, explicitView)
  ) {
    redirect(coachDirectoryHref(filters, {}, explicitView));
  }
  return (
    <CoachDirectory
      state={await publicCoachDirectory(filters)}
      view={normalizeCoachExploreView(rawSearchParams)}
      searchView={explicitView}
      locationSearchConfiguration={resolveLocationSearchConfiguration(
        process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
      )}
    />
  );
}
