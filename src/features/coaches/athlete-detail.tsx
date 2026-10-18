"use client";
import Link from "next/link";
import { useActor } from "@/auth/client/actor-provider";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import { ConnectionAvatar } from "@/features/connections/connection-avatar";
import { CoachClientCards } from "./coach-client-cards";

export function AthleteDetail({
  actorKey,
  pairId,
  bookings,
  referenceTime,
}: {
  actorKey: string;
  pairId: string;
  bookings: readonly PrivateBookingProjection[];
  referenceTime: string;
}) {
  const { actor } = useActor();
  if (
    actor.status !== "authorized" ||
    `${actor.demoRun.slug}:${actor.profile.slug}` !== actorKey
  )
    return (
      <p role="status">
        Sign in with the connected coach account to view athlete details.
      </p>
    );
  const athlete = bookings[0];
  if (!athlete) return null;
  return (
    <div className="private-athlete-detail">
      <Link className="button secondary" href="/coach/athletes">
        Back to My athletes
      </Link>
      <header className="private-athlete-heading">
        <ConnectionAvatar
          name={athlete.clientDisplayName}
          imageUrl={athlete.clientAvatarUrl}
        />
        <div>
          <span className="eyebrow">YOUR ATHLETE</span>
          <h1>{athlete.clientDisplayName}</h1>
          <p>Your private connection and shared sessions.</p>
        </div>
      </header>
      <Link className="button dark" href={`/messages?pair=${pairId}`}>
        Message athlete
      </Link>
      <CoachClientCards bookings={bookings} referenceTime={referenceTime} />
    </div>
  );
}
