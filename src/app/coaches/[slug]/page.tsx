import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { currentClientCoachMarketplaceWorkspace } from "@/server/coaches/booking-request-service";
import { publicCoachProfile } from "@/server/coaches/service";

export const metadata: Metadata = {
  title: "Coach profile",
  description:
    "A fictional MovX coach profile with disciplines and a coach-confirmed public training place.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await publicCoachProfile(slug);
  if (state.status !== "ready") {
    if (state.status === "not-found") notFound();
    return <CoachProfileUnavailable />;
  }
  const bookingState = await currentClientCoachMarketplaceWorkspace(
    state.slots.map((slot) => slot.id),
  );
  const actor =
    bookingState.status === "authorized"
      ? {
          status: "authorized" as const,
          actorProfileId: bookingState.actorProfileId,
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
        <CoachMarketplace
          coachProfileId={state.coach.profileId}
          coachDisplayName={state.coach.displayName}
          coachSlug={state.coach.slug}
          slots={state.slots}
          actor={actor}
          referenceTime={new Date().toISOString()}
        />
      }
    />
  );
}
