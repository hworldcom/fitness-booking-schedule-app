import type { Metadata } from "next";
import { CoachStoryHome } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "Private coaching and group-funded training",
  description:
    "Discover martial-arts coaches, buy coach-specific credits for private calendar booking, or help a threshold-funded group event happen.",
};

export default function Page() {
  return <CoachStoryHome />;
}
