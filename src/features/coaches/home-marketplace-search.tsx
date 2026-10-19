import type { CoachDirectoryFilters } from "@/domain/coaches";
import { HomeDisciplineNavigation } from "./home-discipline-navigation";

export function HomeMarketplaceSearch({
  filters,
}: {
  filters: CoachDirectoryFilters;
}) {
  return (
    <div className="home-marketplace-search">
      <HomeDisciplineNavigation filters={filters} />
    </div>
  );
}
