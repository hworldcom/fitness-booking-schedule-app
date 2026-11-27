export type MyCoachesSection = "connected" | "requests";

export function myCoachesSection(
  value: string | string[] | undefined,
): MyCoachesSection {
  return value === "requests" ? "requests" : "connected";
}

export function myCoachesHref(
  section: MyCoachesSection,
  filter: AthleteCoachFilter = "all",
) {
  return section === "requests"
    ? "/my-coaches?section=requests"
    : filter === "all"
      ? "/my-coaches"
      : `/my-coaches?status=${filter}`;
}
import type { AthleteCoachFilter } from "./athlete-coaches";
