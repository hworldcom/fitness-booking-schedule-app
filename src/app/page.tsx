import type { Metadata } from "next";
import { connection } from "next/server";
import { normalizeCoachDirectoryFilters } from "@/domain/coaches";
import { CoachStoryHome } from "@/features/public/coach-story";
import { publicCoachDirectory } from "@/server/coaches/service";

export const metadata: Metadata = {
  title: "Discover coaches and request private sessions",
  description:
    "Discover martial-arts coaches, compare published availability and request coach confirmation for one private session.",
};

export default async function Page() {
  await connection();
  const directory = await publicCoachDirectory(
    normalizeCoachDirectoryFilters({}),
  );
  return <CoachStoryHome directory={directory} />;
}
