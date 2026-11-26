"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { COACH_DISCIPLINES, type CoachDiscipline } from "@/domain/coaches";

const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;

export function ExploreCategoryFilter({
  initialSelection,
}: {
  initialSelection: readonly CoachDiscipline[];
}) {
  const [selected, setSelected] = useState(initialSelection);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrated,
    getServerHydrated,
  );
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        root.current?.open &&
        event.target instanceof Node &&
        !root.current.contains(event.target)
      )
        root.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details
      ref={root}
      className="explore-category-filter"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          event.currentTarget.open = false;
      }}
    >
      <summary
        aria-label={`Categories${selected.length ? `, ${selected.length} selected` : ""}`}
        className={selected.length ? "active" : ""}
      >
        <span>Categories</span>
        {selected.length > 0 && <b aria-hidden="true">{selected.length}</b>}
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="explore-category-panel">
        <p>Match any selected category.</p>
        <fieldset className="explore-category-options">
          <legend className="sr-only">Choose coach categories</legend>
          {COACH_DISCIPLINES.map((discipline) => (
            <label key={discipline}>
              <input
                type="checkbox"
                name="discipline"
                value={discipline}
                checked={selected.includes(discipline)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelected((previous) =>
                    checked
                      ? [...previous, discipline]
                      : previous.filter((value) => value !== discipline),
                  );
                }}
              />
              <span>{discipline}</span>
            </label>
          ))}
        </fieldset>
        <div className="explore-category-actions">
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => setSelected([])}
          >
            Clear selection
          </button>
          <button type="submit" className="button dark">
            Apply categories
          </button>
        </div>
        <noscript>
          <p>Uncheck categories to clear the selection.</p>
        </noscript>
      </div>
    </details>
  );
}
