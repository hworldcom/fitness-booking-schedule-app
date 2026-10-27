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
import homeBackground from "../../public/images/home-battle-ropes.jpg";
import "@/features/public/training-calendar-intro.css";

export const metadata: Metadata = {
  title: "Find training. Build your routine.",
  description:
    "Discover coaches and group sessions, plan your weekly workouts and track completed activities in your private MovX calendar.",
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
  return <CoachStoryHome directory={directory} background={homeBackground} />;
}
