import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { currentClientCoachMarketplaceWorkspace } from "@/server/coaches/booking-request-service";
import { publicCoachProfile } from "@/server/coaches/service";
import { calendarDate } from "@/domain/coach-calendar";
import {
  publicScheduleSelection,
  publicScheduleSlots,
} from "@/domain/public-coach-schedule";

export async function PublicCoachPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await publicCoachProfile(slug);
  if (state.status !== "ready") {
    if (state.status === "not-found") notFound();
    return <CoachProfileUnavailable />;
  }
  const query = await searchParams;
  const selection = publicScheduleSelection(query.date, state.databaseTime);
  const daySlots = publicScheduleSlots(state.slots, state.databaseTime).filter(
    (slot) => calendarDate(slot.startsAt) === selection.date,
  );
  const bookingState = await currentClientCoachMarketplaceWorkspace(
    daySlots.map((slot) => slot.id),
  );
  const actor =
    bookingState.status === "authorized"
      ? {
          status: "authorized" as const,
          actorProfileId: bookingState.actorProfileId,
          subject: bookingState.subject,
          actorIdentity: bookingState.actorIdentity,
          bookings: bookingState.bookings.filter(
            (booking) => booking.coachProfileId === state.coach.profileId,
          ),
          pendingRequests: bookingState.pendingRequests.filter(
            (request) => request.coachProfileId === state.coach.profileId,
          ),
        }
      : bookingState;
  return (
    <CoachProfileView
      state={state}
      marketplace={
        <>
          {!(
            actor.status === "authorized" &&
            actor.actorProfileId === state.coach.profileId
          ) && (
            <section className="coach-contact-action">
              <div>
                <strong>Have a question first?</strong>
                <p>Message the coach before choosing a session.</p>
              </div>
              <Link
                className="button dark"
                href={`/messages?coach=${state.coach.profileId}`}
              >
                Message coach
              </Link>
            </section>
          )}
          <CoachMarketplace
            key={`${slug}:${selection.date}:${actor.status === "authorized" ? actor.subject + actor.actorIdentity : actor.status}`}
            coachProfileId={state.coach.profileId}
            coachDisplayName={state.coach.displayName}
            coachSlug={state.coach.slug}
            publicPath={state.coach.publicPath}
            slots={state.slots}
            actor={actor}
            referenceTime={state.databaseTime}
            selectedDate={query.date}
          />
        </>
      }
    />
  );
}
