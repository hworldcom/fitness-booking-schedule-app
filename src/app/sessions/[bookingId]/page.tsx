import { notFound } from "next/navigation";
import { sessionUuid } from "@/domain/session-types";
import { BookingEditor } from "@/features/session-types/booking-editor";
export const metadata = { title: "Session details" };
export default async function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (!sessionUuid(bookingId)) notFound();
  return <BookingEditor bookingId={bookingId} />;
}
