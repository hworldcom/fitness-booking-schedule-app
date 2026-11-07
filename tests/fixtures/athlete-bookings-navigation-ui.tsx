"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import { Shell } from "@/components/shell";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import {
  MySessionsHeading,
  MySessionsNavigation,
} from "@/features/profile/my-sessions-navigation";
import { BookingEditor } from "@/features/session-types/booking-editor";

export const actor = {
  status: "authorized",
  profile: {
    slug: "fixture",
    displayName: "Fixture Athlete",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "mov202", name: "Isolated navigation fixture" },
  role: "member",
  coachAccessStatus: "not-applied",
} as const;

export default function Fixture() {
  const pathname = usePathname();
  const [unavailable, setUnavailable] = useState(false);
  const active =
    pathname === "/sessions/calendar"
      ? "calendar"
      : pathname === "/sessions/routine"
        ? "routine"
        : pathname === "/sessions/groups"
          ? "group"
          : "private";
  const detail = pathname === "/sessions/20200000-0000-4000-8000-000000000001";
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "20200000-0000-4000-8000-000000000001",
        email: "fixture@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider initialActor={actor}>
        <Shell>
          <div className="training-page">
            {pathname === "/my-coaches" ? (
              <h1>My coaches</h1>
            ) : detail ? (
              <BookingEditor bookingId="20200000-0000-4000-8000-000000000001" />
            ) : unavailable ? (
              <>
                <MySessionsNavigation active={active} />
                <ProtectedAccessUnavailable />
              </>
            ) : (
              <>
                <MySessionsHeading active={active} />
                <p>
                  Fictional navigation fixture. No bookings or personal workouts
                  are loaded.
                </p>
                <button onClick={() => setUnavailable(true)}>
                  Show access failure
                </button>
              </>
            )}
          </div>
        </Shell>
      </ActorProvider>
    </AuthSessionProvider>
  );
}
