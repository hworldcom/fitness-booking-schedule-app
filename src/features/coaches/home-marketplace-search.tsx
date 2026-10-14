import Form from "next/form";
import { Search } from "lucide-react";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import { homeDirectoryHref } from "./home-marketplace-contract";
import { HomeDisciplineInput } from "./home-discipline-input";
import { HomeDisciplineNavigation } from "./home-discipline-navigation";

export function HomeMarketplaceSearch({
  filters,
}: {
  filters: CoachDirectoryFilters;
}) {
  return (
    <div className="home-marketplace-search">
      <Form
        key={homeDirectoryHref(filters)}
        action="/"
        className="home-coach-search"
        aria-label="Search coaches"
        scroll={false}
      >
        <label htmlFor="home-discipline">
          <span>Discipline</span>
          <HomeDisciplineInput discipline={filters.discipline} />
        </label>
        <label htmlFor="home-location">
          <span>Where in Berlin?</span>
          <input
            id="home-location"
            type="search"
            name="location"
            defaultValue={filters.location}
            placeholder="Area, gym or public place"
            maxLength={120}
          />
        </label>
        <button className="button dark" type="submit">
          <Search size={17} aria-hidden="true" /> Search coaches
        </button>
      </Form>
      <HomeDisciplineNavigation filters={filters} />
    </div>
  );
}
