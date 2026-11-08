import { notFound } from "next/navigation";
import { sessionUuid } from "@/domain/session-types";
import { ExternalClientsWorkspace } from "@/features/external-clients/workspace";
export const metadata = {
  title: "Athlete sessions & notes",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  if (!sessionUuid(clientId)) notFound();
  return <ExternalClientsWorkspace clientId={clientId} />;
}
