"use client";

import { COACH_DISCIPLINES, type CoachDiscipline } from "@/domain/coaches";
import {
  HOME_DISCIPLINE_PATTERN,
  homeDiscipline,
} from "./home-marketplace-contract";

export function HomeDisciplineInput({
  discipline,
}: {
  discipline: CoachDiscipline | null;
}) {
  return (
    <>
      <input
        id="home-discipline"
        name="discipline"
        type="search"
        list="home-discipline-suggestions"
        defaultValue={discipline ?? ""}
        placeholder="All disciplines"
        maxLength={60}
        autoComplete="off"
        spellCheck={false}
        pattern={HOME_DISCIPLINE_PATTERN}
        title="Choose a discipline from the suggestions, or leave blank for all disciplines."
        onInput={(event) => {
          const input = event.currentTarget;
          const normalized = input.value
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();
          const canonical = homeDiscipline(input.value);
          if (canonical) input.value = canonical;
          else if (normalized === "all disciplines") input.value = "";
          input.setCustomValidity(
            input.value.trim() && !canonical && normalized !== "all disciplines"
              ? "Choose a discipline from the suggestions, or leave blank for all disciplines."
              : "",
          );
        }}
      />
      <datalist id="home-discipline-suggestions">
        {COACH_DISCIPLINES.map((value) => (
          <option
            key={value}
            value={value}
            label={value === "Brazilian Jiu-Jitsu" ? "BJJ" : undefined}
          />
        ))}
      </datalist>
    </>
  );
}
