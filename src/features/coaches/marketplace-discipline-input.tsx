"use client";

import { COACH_DISCIPLINES, type CoachDiscipline } from "@/domain/coaches";
import {
  DISCIPLINE_SEARCH_PATTERN,
  marketplaceDiscipline,
} from "./discipline-search-contract";

export function MarketplaceDisciplineInput({
  discipline,
  prefix,
}: {
  discipline: CoachDiscipline | null;
  prefix: "home" | "explore";
}) {
  return (
    <>
      <input
        id={`${prefix}-discipline`}
        name="discipline"
        type="search"
        list={`${prefix}-discipline-suggestions`}
        defaultValue={discipline ?? ""}
        placeholder="All disciplines"
        maxLength={60}
        autoComplete="off"
        spellCheck={false}
        pattern={DISCIPLINE_SEARCH_PATTERN}
        title="Choose a discipline from the suggestions, or leave blank for all disciplines."
        onInput={(event) => {
          const input = event.currentTarget;
          const normalized = input.value
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();
          const canonical = marketplaceDiscipline(input.value);
          if (canonical) input.value = canonical;
          else if (normalized === "all disciplines") input.value = "";
          input.setCustomValidity(
            input.value.trim() && !canonical && normalized !== "all disciplines"
              ? "Choose a discipline from the suggestions, or leave blank for all disciplines."
              : "",
          );
        }}
      />
      <datalist id={`${prefix}-discipline-suggestions`}>
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
