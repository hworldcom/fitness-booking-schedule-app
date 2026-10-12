import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeCoachDirectoryFilters } from "@/domain/coaches";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
import {
  canonicalCoachExploreView,
  coachDirectoryHref,
  isCanonicalCoachDirectorySearch,
  normalizeCoachExploreView,
} from "@/features/coaches/marketplace-search-contract";
import { publicCoachDirectory } from "@/server/coaches/service";

export const metadata: Metadata = {
  title: "Explore martial-arts coaches",
  description:
    "Browse fictional martial-arts coach profiles by discipline and coach-confirmed public training place.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearchParams = await searchParams;
  const filters = normalizeCoachDirectoryFilters(rawSearchParams);
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
    />
  );
}
