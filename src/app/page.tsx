import type { Metadata } from "next";
import { CoachStoryHome } from "@/features/public/coach-story";

export const metadata: Metadata = {
  title: "Discover coaches and book private sessions",
  description:
    "Discover martial-arts coaches, compare published availability and book one private session directly.",
};

export default function Page() {
  return <CoachStoryHome />;
}
