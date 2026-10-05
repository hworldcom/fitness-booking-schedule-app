import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
import { publicCoachPassCatalogue } from "@/server/coaches/pass-catalogue";
import { publicCoachProfile } from "@/server/coaches/service";
import {
  currentCoachFollowState,
  publicCoachPosts,
} from "@/server/coaches/social-service";

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
  const [postsState, followState, catalogue, bookingState] = await Promise.all([
    publicCoachPosts(state.coach.profileId),
    currentCoachFollowState(state.coach.profileId),
    publicCoachPassCatalogue(state.coach.profileId),
    currentPrivateBookingWorkspace(),
  ]);
  const actor =
    bookingState.status === "authorized"
      ? {
          status: "authorized" as const,
          credit:
            bookingState.clientCredits.find(
              (credit) => credit.coachProfileId === state.coach.profileId,
            ) ?? null,
          bookings: bookingState.bookings.filter(
            (booking) => booking.coachProfileId === state.coach.profileId,
          ),
        }
      : bookingState;
  return (
    <CoachProfileView
      state={state}
      postsState={postsState}
      followState={followState}
      marketplace={
        <CoachMarketplace
          coachProfileId={state.coach.profileId}
          coachDisplayName={state.coach.displayName}
          coachSlug={state.coach.slug}
          earlyCancellationMinutes={state.coach.earlyCancellationMinutes}
          slots={state.slots}
          catalogue={catalogue}
          actor={actor}
        />
      }
    />
  );
}
