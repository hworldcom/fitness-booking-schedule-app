import { notFound } from "next/navigation";
import { coachSessionBookingPage } from "@/server/coaches/typed-session-service";
import { BookingEditor } from "@/features/session-types/booking-editor";
export const metadata = {
  title: "Session notes & videos",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = await coachSessionBookingPage(bookingId);
  if (result.status === "unavailable")
    return (
      <section role="alert">
        <h1>Session unavailable</h1>
        <p>Your session could not be loaded. Please try again.</p>
      </section>
    );
  if (result.status !== "ready") notFound();
  return (
    <BookingEditor
      bookingId={bookingId}
      coachView
      initialBooking={result.initialBooking}
    />
  );
}
