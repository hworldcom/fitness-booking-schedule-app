import type { Metadata } from "next";
import { HowItWorksStory } from "@/features/public/how-it-works";

import "@/features/public/how-it-works.css";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Find private coaching or a group class that feels right for you. Learn how to train with MovX or offer sessions as a coach.",
};

export default function Page() {
  return <HowItWorksStory />;
}
