import type { Metadata } from "next";
import { CoachStoryHome } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "Find your martial-arts coach",
  description:
    "Discover martial-arts coaches, choose a private weekly slot and use a clear one-session or ten-session TrainingPass.",
};

export default function Page() {
  return <CoachStoryHome />;
}
