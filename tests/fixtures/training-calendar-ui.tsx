"use client";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider, useActor } from "@/auth/client/actor-provider";
import { TrainingCalendar } from "@/features/training/training-calendar";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import type { TrainingPage } from "@/training/contracts";
import "@/features/training/training.css";
const initial: TrainingPage = {
  items: [],
  next: null,
  now: "2026-10-26T12:00:00Z",
  weekCount: 0,
  monthCount: 0,
  remindersEnabled: false,
};
export default function Fixture({
  view = "week",
}: {
  view?: "week" | "month";
}) {
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "12000000-0000-4000-8000-000000000001",
        email: "fixture@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider
        initialActor={{
          status: "authorized",
          profile: {
            slug: "fixture",
            displayName: "Training athlete",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "mov120", name: "Isolated training fixture" },
          role: "member",
          coachAccessStatus: "not-applied",
        }}
      >
        <main className="training-page">
          <ActorRefresh />
          <MySessionsHeading active="calendar" />
          <TrainingCalendar
            initial={initial}
            scope="mov120:fixture"
            date="2026-10-26"
            view={view}
            timezone="UTC"
          />
        </main>
      </ActorProvider>
    </AuthSessionProvider>
  );
}
function ActorRefresh() {
  const { refreshActor } = useActor();
  return (
    <button onClick={() => void refreshActor()}>Refresh fixture actor</button>
  );
}
