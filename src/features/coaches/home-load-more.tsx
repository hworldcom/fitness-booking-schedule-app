import Link from "next/link";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import { coachDirectoryHref } from "./marketplace-search-contract";

export function HomeExploreMore({
  filters,
}: {
  filters: CoachDirectoryFilters;
}) {
  return (
    <div className="home-coach-pagination">
      <Link
        className="button secondary"
        href={coachDirectoryHref(filters, { query: "", location: "" })}
      >
        Explore more
      </Link>
    </div>
  );
}
