import { notFound } from "next/navigation";
import { currentActorSnapshot } from "@/server/authorization/service";
import { sessionNotesCommand } from "@/server/notes/service";
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
  const actor = await currentActorSnapshot();
  if (actor.status !== "authorized") notFound();
  const result = await sessionNotesCommand(
    { action: "read", args: { bookingId, kind: "shared" } },
    `${actor.demoRun.slug}:${actor.profile.slug}`,
  );
  if (result.status === "unavailable")
    return (
      <section role="alert">
        <h1>Session unavailable</h1>
        <p>Your session could not be loaded. Please try again.</p>
      </section>
    );
  if (result.status !== "ready" || !result.value.viewerIsCoach) notFound();
  return <BookingEditor bookingId={bookingId} coachView />;
}
