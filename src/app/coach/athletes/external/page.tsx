import { ExternalClientsWorkspace } from "@/features/external-clients/workspace";
export const metadata = {
  title: "External clients",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ExternalClientsWorkspace />;
}
