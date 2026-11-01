import { InvitationReview } from "@/features/external-clients/invitation-review";
export const metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <InvitationReview />;
}
