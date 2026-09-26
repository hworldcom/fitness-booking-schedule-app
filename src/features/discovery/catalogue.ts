import type { GymSummary } from "@/domain/catalogue";
import type { DiscoveryItem } from "@/domain/discovery";

export function discoveryCatalogue(
  gyms: readonly GymSummary[],
): DiscoveryItem[] {
  return gyms.map((gym) => ({
    kind: "Studio",
    title: gym.name,
    detail: `${gym.area} · ${gym.coaches.join(", ")}`,
    href: `/explore?q=${encodeURIComponent(gym.name)}`,
    activity: gym.activities.join(" "),
  }));
}
