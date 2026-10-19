import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
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
  const { filters } = normalizeHomeSearch(rawSearchParams);
  if (!isCanonicalHomeSearch(rawSearchParams, filters))
    redirect(homeDirectoryHref(filters));
  const directory = await publicCoachDirectory(filters);
  return <CoachStoryHome directory={directory} />;
}
