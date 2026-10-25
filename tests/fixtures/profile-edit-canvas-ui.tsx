"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider, useActor } from "@/auth/client/actor-provider";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { CoachProfileCanvas } from "@/features/coaches/website/coach-profile-canvas";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { EMPTY_COACH_WEBSITE_CONTENT } from "@/domain/coach-website";
import {
  PUBLIC_SCHEDULE_COACH,
  PUBLIC_SCHEDULE_NOW,
  PUBLIC_SCHEDULE_SLOTS,
  PUBLIC_SCHEDULE_SUBJECT,
} from "./public-schedule-data";

export const PROFILE_CANVAS_ACTOR: ActorSnapshot = {
  status: "authorized",
  profile: {
    slug: PUBLIC_SCHEDULE_COACH.slug,
    displayName: "Fixture Coach",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: {
    slug: "profile-canvas-fixture",
    name: "Isolated interface fixture",
  },
  role: "member",
  coachAccessStatus: "demo",
};
function Canvas() {
  const query = useSearchParams();
  const { refreshActor } = useActor();
  const [hidden, setHidden] = useState(false);
  const coach = {
    ...PUBLIC_SCHEDULE_COACH,
    displayName: "Alex Morgan",
    visibility: hidden ? ("hidden" as const) : ("visible" as const),
  };
  const date = query.get("date") ?? "2026-10-16";
  return (
    <main className="public-app-main" style={{ padding: 24 }}>
      <aside aria-label="Fixture controls">
        <p>
          Isolated MOV-100 interface fixture. No real accounts or database
          writes.
        </p>
        <button onClick={() => setHidden(!hidden)}>
          Toggle hidden fixture
        </button>{" "}
        <button onClick={() => void refreshActor()}>
          Refresh fixture actor
        </button>
      </aside>
      <CoachProfileCanvas
        coach={coach}
        gyms={[]}
        ownerDisplayName="Fixture Coach"
        publicUrl={{ status: "unavailable" }}
        locationSearchConfiguration={{ status: "missing" }}
        scheduleLinks={{
          availability: `/coach?view=schedule&section=availability&date=${date}`,
          calendar: `/coach?view=schedule&section=calendar&date=${date}&calendarView=week&type=all`,
        }}
        presentation={
          hidden
            ? null
            : {
                state: {
                  status: "ready",
                  coach,
                  slots: [],
                  website: {
                    schemaVersion: 1,
                    revision: 0,
                    content: EMPTY_COACH_WEBSITE_CONTENT,
                    banner: null,
                  },
                },
                reviews: {
                  status: "ready",
                  summary: { count: 0, mean: null, fictional: true },
                  reviews: [],
                  nextCursor: null,
                },
                groups: { status: "ready", sessions: [] },
                marketplace: (
                  <CoachMarketplace
                    coachProfileId={coach.profileId}
                    coachDisplayName={coach.displayName}
                    coachSlug={coach.slug}
                    schedulePath="/profile/coach"
                    slots={PUBLIC_SCHEDULE_SLOTS}
                    actor={{
                      status: "authorized",
                      actorProfileId: coach.profileId,
                      subject: PUBLIC_SCHEDULE_SUBJECT,
                      actorIdentity: `${coach.slug}:profile-canvas-fixture:member`,
                      bookings: [],
                      pendingRequests: [],
                    }}
                    referenceTime={PUBLIC_SCHEDULE_NOW}
                    selectedDate={date}
                  />
                ),
              }
        }
      />
    </main>
  );
}
export default function ProfileCanvasFixture() {
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: PUBLIC_SCHEDULE_SUBJECT,
        email: "fixture@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider initialActor={PROFILE_CANVAS_ACTOR}>
        <Suspense>
          <Canvas />
        </Suspense>
      </ActorProvider>
    </AuthSessionProvider>
  );
}
