import { BookingEditor } from "@/features/session-types/booking-editor";
export const metadata = { title: "Schedule a client" };
import { sessionUuid } from "@/domain/session-types";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ externalClientId?: string }>;
}) {
  const { externalClientId } = await searchParams;
  return (
    <BookingEditor
      initialExternalClientId={
        sessionUuid(externalClientId) ? externalClientId : undefined
      }
    />
  );
}
