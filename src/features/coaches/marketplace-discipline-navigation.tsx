"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Flame,
  Footprints,
  HandFist,
  LayoutGrid,
  Swords,
  UsersRound,
} from "lucide-react";
import {
  COACH_DISCIPLINES,
  type CoachDirectoryFilters,
} from "@/domain/coaches";
import { homeDirectoryHref } from "./home-marketplace-contract";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";

const icons = {
  Boxing: HandFist,
  "Muay Thai": Flame,
  Kickboxing: Footprints,
  "Brazilian Jiu-Jitsu": CircleDot,
  MMA: Swords,
  Wrestling: UsersRound,
};

export function MarketplaceDisciplineNavigation({
  filters,
  destination,
  view = null,
}: {
  filters: CoachDirectoryFilters;
  destination: "home" | "explore";
  view?: CoachExploreView | null;
}) {
  const prefix = destination;
  const trackId = `${prefix}-discipline-track`;
  const track = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = track.current;
    const selected = element?.querySelector('[aria-current="page"]');
    if (!element || !selected) return;
    const bounds = element.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    const left =
      item.left < bounds.left
        ? item.left - bounds.left
        : item.right > bounds.right
          ? item.right - bounds.right
          : 0;
    if (left) element.scrollBy({ left, behavior: "instant" });
  }, [filters.discipline]);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () =>
      setCanScroll({
        previous: element.scrollLeft > 1,
        next:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);
  function scroll(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(132, element.clientWidth * 0.75),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <nav
      className="home-discipline-navigation"
      aria-label="Browse coaches by discipline"
    >
      <button
        className="home-discipline-scroll-button"
        type="button"
        aria-label="Previous disciplines"
        aria-controls={trackId}
        disabled={!canScroll.previous}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div id={trackId} className="home-discipline-track" ref={track}>
        {[null, ...COACH_DISCIPLINES].map((discipline) => {
          const Icon = discipline ? icons[discipline] : LayoutGrid;
          const selected = filters.discipline === discipline;
          return (
            <Link
              key={discipline ?? "all"}
              href={
                destination === "home"
                  ? homeDirectoryHref({ ...filters, discipline })
                  : coachDirectoryHref(filters, { discipline }, view)
              }
              prefetch={false}
              scroll={false}
              className={
                "home-discipline-shortcut" + (selected ? " active" : "")
              }
              aria-current={selected ? "page" : undefined}
              onNavigate={() => {
                const input = document.getElementById(
                  `${prefix}-discipline`,
                ) as HTMLInputElement | null;
                if (input) {
                  input.value = discipline ?? "";
                  input.setCustomValidity("");
                }
                const location = document.getElementById(
                  `${prefix}-location`,
                ) as HTMLInputElement | null;
                if (location) location.value = filters.location;
                const query = document.getElementById(
                  `${prefix}-query`,
                ) as HTMLInputElement | null;
                if (query) query.value = filters.query;
              }}
            >
              <Icon size={23} aria-hidden="true" />
              <span>{discipline ?? "All disciplines"}</span>
            </Link>
          );
        })}
      </div>
      <button
        className="home-discipline-scroll-button"
        type="button"
        aria-label="Next disciplines"
        aria-controls={trackId}
        disabled={!canScroll.next}
        onClick={() => scroll(1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
