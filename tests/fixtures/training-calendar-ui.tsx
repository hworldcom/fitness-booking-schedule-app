"use client";
import { useEffect, useState } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider, useActor } from "@/auth/client/actor-provider";
import { TrainingCalendar } from "@/features/training/training-calendar";
import { PlanRoutine } from "@/features/training/plan-routine";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import { calendarPeriod, type TrainingPage } from "@/training/contracts";
import "@/features/training/training.css";
export default function Fixture({
  view = "week",
  routine = false,
  date = "2026-10-26",
  timezone = "UTC",
  selected,
}: {
  view?: "week" | "month";
  routine?: boolean;
  date?: string;
  timezone?: string;
  selected?: string;
}) {
  const identity = `${routine}:${date}:${view}:${timezone}`;
  const [loaded, setLoaded] = useState<{
    identity: string;
    page: TrainingPage;
  } | null>(null);
  useEffect(() => {
    let current = true;
    const period = calendarPeriod(date, routine ? "week" : view);
    // The fixture substitutes a server-rendered read with its explicit API model.
    // This makes route changes start with fresh data, as the real page does.
    void fetch("/api/training", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "mov120:fixture",
        command: {
          action: "list",
          args: { from: period.from, through: period.through, timezone },
        },
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (current && result.status === "ready")
          setLoaded({ identity, page: result.value });
      });
    return () => {
      current = false;
    };
  }, [identity, date, view, timezone, routine]);
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
          <MySessionsHeading active={routine ? "routine" : "calendar"} />
          {loaded?.identity === identity &&
            (routine ? (
              <PlanRoutine
                key={identity}
                initial={loaded.page}
                scope="mov120:fixture"
                date={date}
                timezone={timezone}
              />
            ) : (
              <TrainingCalendar
                key={identity}
                initial={loaded.page}
                scope="mov120:fixture"
                date={date}
                view={view}
                timezone={timezone}
                selected={selected}
              />
            ))}
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
