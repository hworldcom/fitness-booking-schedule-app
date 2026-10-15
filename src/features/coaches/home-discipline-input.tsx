import type { CoachDiscipline } from "@/domain/coaches";
import { MarketplaceDisciplineInput } from "./marketplace-discipline-input";

export function HomeDisciplineInput({
  discipline,
}: {
  discipline: CoachDiscipline | null;
}) {
  return <MarketplaceDisciplineInput discipline={discipline} prefix="home" />;
}
