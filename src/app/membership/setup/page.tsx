import type { MembershipPlanId } from "@/domain/catalogue";
import { MembershipSetup } from "@/features/membership/setup";
import { currentPublicCatalogue } from "@/server/catalogue/service";

export const metadata = {
  title: "Membership setup",
  description:
    "Choose a MovX Club plan and four gyms, then activate it with test EURC on Solana Devnet.",
};

function planFromQuery(value: string | undefined): MembershipPlanId | null {
  return value === "basic" || value === "classic" ? value : null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [{ plan }, catalogueResult] = await Promise.all([
    searchParams,
    currentPublicCatalogue(),
  ]);
  return (
    <MembershipSetup
      initialPlan={planFromQuery(plan)}
      catalogueResult={catalogueResult}
    />
  );
}
