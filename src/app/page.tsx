import type { Metadata } from "next";
import { ComingSoonScreen } from "@/features/waitlist/coming-soon";

export const metadata: Metadata = {
  title: "MovX Club — Find your coach.",
  description:
    "Join the early-access list for MovX Club's coach-first training-package demo.",
};

export default function Page() {
  return <ComingSoonScreen />;
}
