import { ExternalAthletesTab } from "@/features/external-clients/workspace";
export const metadata = {
  title: "External athletes",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ExternalAthletesTab />;
}
