import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how MovX connects martial-arts coach discovery, private weekly slots and clear one-session or ten-session TrainingPasses.",
};

export default function Page() {
  return <HowItWorksStory />;
}
