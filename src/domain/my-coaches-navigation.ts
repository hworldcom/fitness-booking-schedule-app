export type MyCoachesSection = "connected" | "requests";

export function myCoachesSection(
  value: string | string[] | undefined,
): MyCoachesSection {
  return value === "requests" ? "requests" : "connected";
}

export function myCoachesHref(section: MyCoachesSection) {
  return section === "requests"
    ? "/my-coaches?section=requests"
    : "/my-coaches";
}
