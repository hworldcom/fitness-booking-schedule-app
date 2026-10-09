import type { Metadata } from "next";
import { normalizeCoachDirectoryFilters } from "@/domain/coaches";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
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
  const filters = normalizeCoachDirectoryFilters(await searchParams);
  return <CoachDirectory state={await publicCoachDirectory(filters)} />;
}
