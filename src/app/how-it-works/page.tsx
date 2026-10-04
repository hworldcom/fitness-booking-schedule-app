import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how MovX connects coach-specific pass booking with threshold-funded group events, exact test EURC and platform-paid Solana fees.",
};

export default function Page() {
  return <HowItWorksStory />;
}
