import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/how-it-works";

import "@/features/public/how-it-works.css";
import "@/features/public/training-calendar-intro.css";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Find private coaching, join a group or plan your own routine. Learn how MovX brings sessions, workouts and private activity logs into one calendar.",
};

export default function Page() {
  return <HowItWorksStory />;
}
