import { COACH_DISCIPLINES, type CoachDiscipline } from "@/domain/coaches";

const disciplineAliases: Readonly<Record<string, CoachDiscipline>> = {
  bjj: "Brazilian Jiu-Jitsu",
  "jiu jitsu": "Brazilian Jiu-Jitsu",
  "jiu-jitsu": "Brazilian Jiu-Jitsu",
  "thai boxing": "Muay Thai",
  "mixed martial arts": "MMA",
};

export function marketplaceDiscipline(value: string): CoachDiscipline | null {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  return (
    COACH_DISCIPLINES.find(
      (discipline) => discipline.toLowerCase() === normalized,
    ) ??
    (Object.hasOwn(disciplineAliases, normalized)
      ? disciplineAliases[normalized]
      : null) ??
    null
  );
}

export const DISCIPLINE_SEARCH_PATTERN =
  "\\s*(?:" +
  [...COACH_DISCIPLINES, ...Object.keys(disciplineAliases), "All disciplines"]
    .map((value) =>
      value
        .replace(
          /[a-z]/gi,
          (letter) => "[" + letter.toLowerCase() + letter.toUpperCase() + "]",
        )
        .replaceAll(" ", "\\s+"),
    )
    .join("|") +
  ")\\s*";
