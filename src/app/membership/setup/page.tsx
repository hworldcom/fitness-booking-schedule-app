import type { MembershipPlanId } from "@/domain/catalogue";
import { MembershipSetup } from "@/features/membership/setup";

export const metadata = {
  title: "Membership setup preview",
  description:
    "Build a browser-local MovX Club membership draft by choosing a plan and four fictional participating gyms.",
};

function planFromQuery(value: string | undefined): MembershipPlanId | null {
  return value === "basic" || value === "classic" ? value : null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return <MembershipSetup initialPlan={planFromQuery(plan)} />;
}
