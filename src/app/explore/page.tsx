import { Explore } from "@/features/discovery/explore";
import { currentPublicCatalogue } from "@/server/catalogue/service";
export const metadata = {
  title: "Explore gyms",
  description:
    "Compare MovX Club Basic and Classic, then explore fictional participating Berlin gyms in the concept preview.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q } = await searchParams;
  const catalogueResult = await currentPublicCatalogue();
  return (
    <Explore
      key={typeof q === "string" ? q : ""}
      initialQuery={typeof q === "string" ? q : ""}
      catalogueResult={catalogueResult}
    />
  );
}
