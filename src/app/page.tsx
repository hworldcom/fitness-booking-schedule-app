import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  homeCoachDirectoryPage,
  homeDirectoryHref,
  isCanonicalHomeSearch,
  normalizeHomeSearch,
  type HomeSearchParams,
} from "@/features/coaches/home-marketplace-contract";
import { CoachStoryHome } from "@/features/public/coach-story";
import { publicCoachDirectory } from "@/server/coaches/service";

export const metadata: Metadata = {
  title: "Discover coaches and request private sessions",
  description:
    "Discover martial-arts and fitness coaches, compare published availability and request coach confirmation for one private session.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  await connection();
  const rawSearchParams = await searchParams;
  const { filters, page } = normalizeHomeSearch(rawSearchParams);
  if (!isCanonicalHomeSearch(rawSearchParams, filters, page))
    redirect(homeDirectoryHref(filters, page));
  const directory = await publicCoachDirectory(filters);
  const actualPage =
    directory.status === "ready"
      ? homeCoachDirectoryPage(directory.entries, page).page
      : 1;
  if (actualPage !== page) redirect(homeDirectoryHref(filters, actualPage));
  return <CoachStoryHome directory={directory} page={actualPage} />;
}
