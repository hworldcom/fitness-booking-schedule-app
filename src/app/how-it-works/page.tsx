import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how MovX connects coach discovery, recurring availability and direct capacity-one private-session booking.",
};

export default function Page() {
  return <HowItWorksStory />;
}
