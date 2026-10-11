import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how MovX connects coach discovery, recurring availability and coach-confirmed capacity-one private sessions.",
};

export default function Page() {
  return <HowItWorksStory />;
}
