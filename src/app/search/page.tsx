import { SearchScreen } from "@/features/discovery/search";
import { currentPublicCatalogue } from "@/server/catalogue/service";

export const metadata = { title: "Search" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const catalogueResult = await currentPublicCatalogue();

  return <SearchScreen query={query} catalogueResult={catalogueResult} />;
}
