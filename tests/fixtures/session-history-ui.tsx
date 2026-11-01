"use client";
import { useState, type ReactNode } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import { SessionHistoryPreview } from "@/features/profile/session-history-preview";
import { historyPreviewView } from "@/features/profile/session-history-preview-model";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import {
  historyBookings,
  historyReferenceTime,
  historyRequest,
} from "./session-history-data";
export const historyActor = {
  status: "authorized" as const,
  profile: {
    slug: "athlete",
    displayName: "Fictional Athlete",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "notes-preview", name: "Fictional test" },
  role: "member" as const,
  coachAccessStatus: "not-applied" as const,
};
export function HistoryFixtureProviders({ children }: { children: ReactNode }) {
  const [foreign, setForeign] = useState(false);
  return (
    <>
      <button onClick={() => setForeign(true)}>Change test actor</button>
      <AuthSessionProvider
        key={String(foreign)}
        initialSession={{
          status: "signed-in",
          subject: foreign ? "foreign-fixture" : "history-fixture",
          email: "fictional@example.invalid",
          expiresAt: null,
        }}
      >
        <ActorProvider
          initialActor={
            foreign
              ? {
                  ...historyActor,
                  profile: { ...historyActor.profile, slug: "other-athlete" },
                }
              : historyActor
          }
        >
          {children}
        </ActorProvider>
      </AuthSessionProvider>
    </>
  );
}
export default function HistoryFixture({
  view,
  empty,
  unavailable,
}: {
  view?: string | string[];
  empty?: string;
  unavailable?: string;
}) {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px" }}>
      <MySessionsHeading active="private" />
      {unavailable ? (
        <ProtectedAccessUnavailable />
      ) : (
        <SessionHistoryPreview
          actorIdentity="notes-preview:athlete:member"
          view={historyPreviewView(view)}
          bookings={empty ? [] : historyBookings}
          referenceTime={historyReferenceTime}
          requests={{
            items: empty ? [] : [historyRequest],
            nextCursor: empty
              ? null
              : { id: historyRequest.id, createdAt: historyRequest.createdAt },
          }}
        />
      )}
    </main>
  );
}
