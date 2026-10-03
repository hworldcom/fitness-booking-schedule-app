import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
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
  const [postsState, followState] = await Promise.all([
    publicCoachPosts(state.coach.profileId),
    currentCoachFollowState(state.coach.profileId),
  ]);
  return (
    <CoachProfileView
      state={state}
      postsState={postsState}
      followState={followState}
    />
  );
}
