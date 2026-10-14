"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import {
  HOME_COACH_PAGE_SIZE,
  homeDirectoryHref,
} from "./home-marketplace-contract";

export function HomeLoadMore({
  filters,
  page,
  hasMore,
}: {
  filters: CoachDirectoryFilters;
  page: number;
  hasMore: boolean;
}) {
  const previousPage = useRef(page);
  const navigationScroll = useRef<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (page > previousPage.current) {
      const grid = document.getElementById("home-coach-grid");
      const card = grid?.children.item(
        previousPage.current * HOME_COACH_PAGE_SIZE,
      );
      card
        ?.querySelector<HTMLAnchorElement>("a")
        ?.focus({ preventScroll: true });
      if (navigationScroll.current) {
        window.scrollTo({ ...navigationScroll.current, behavior: "instant" });
      }
    }
    navigationScroll.current = null;
    previousPage.current = page;
  }, [page]);
  if (!hasMore) return null;
  return (
    <div className="home-coach-pagination">
      <Link
        className="button secondary"
        href={homeDirectoryHref(filters, page + 1)}
        scroll={false}
        prefetch={false}
        aria-controls="home-coach-grid"
        onNavigate={() => {
          navigationScroll.current = {
            left: window.scrollX,
            top: window.scrollY,
          };
        }}
      >
        Load more
      </Link>
    </div>
  );
}
