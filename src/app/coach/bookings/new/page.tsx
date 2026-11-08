import { BookingEditor } from "@/features/session-types/booking-editor";
import { CoachWorkspacePage } from "@/app/coach/workspace-page";
export const metadata = { title: "Schedule a client" };
import { sessionUuid } from "@/domain/session-types";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ externalClientId?: string }>;
}) {
  const { externalClientId } = await searchParams;
  const clientId = sessionUuid(externalClientId) ? externalClientId : undefined;
  const returnHref = clientId
    ? `/coach/bookings/new?externalClientId=${clientId}`
    : "/coach/bookings/new";
  return (
    <CoachWorkspacePage
      area="bookings"
      active="new-booking"
      returnHref={returnHref}
    >
      <BookingEditor initialExternalClientId={clientId} embedded />
    </CoachWorkspacePage>
  );
}
