export type CoachAthletesSection = "connected" | "external" | "requests";

export function coachAthletesSection(value: string | string[] | undefined) {
  return value === "requests" ? "requests" : "connected";
}

export function coachAthletesHref(section: CoachAthletesSection) {
  return section === "external"
    ? "/coach/athletes/external"
    : section === "requests"
      ? "/coach/athletes?section=requests"
      : "/coach/athletes";
}
