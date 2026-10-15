import type { CoachDirectoryFilters } from "@/domain/coaches";
import { MarketplaceDisciplineNavigation } from "./marketplace-discipline-navigation";

export function HomeDisciplineNavigation({
  filters,
}: {
  filters: CoachDirectoryFilters;
}) {
  return (
    <MarketplaceDisciplineNavigation filters={filters} destination="home" />
  );
}
