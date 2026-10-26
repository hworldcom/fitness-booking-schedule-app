"use client";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import { MemberProfileCard } from "@/features/profile/member-profile";
import { Mailbox } from "@/features/messages/mailbox";
export default function MessageProfileFixture() {
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "ae011500-0000-4000-8000-000000000001",
        email: "fixture@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider
        initialActor={{
          status: "authorized",
          profile: {
            slug: "mov115-viewer",
            displayName: "Fixture viewer",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "mov115-fixture", name: "Isolated fixture" },
          role: "member",
          coachAccessStatus: "demo",
        }}
      >
        <div className="messages-shell">
          <header className="messages-shell-header">
            Isolated Messages fixture
          </header>
          <main className="messages-shell-main">
            <Mailbox conversationId="ae011500-0000-4000-8000-000000000004" />
          </main>
        </div>
      </ActorProvider>
    </AuthSessionProvider>
  );
}

export function MemberProfileFixture({
  id,
  mismatch = false,
}: {
  id: string;
  mismatch?: boolean;
}) {
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "ae011500-0000-4000-8000-000000000001",
        email: "fixture@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider
        initialActor={{
          status: "authorized",
          profile: {
            slug: "mov115-viewer",
            displayName: "Fixture viewer",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "mov115-fixture", name: "Isolated fixture" },
          role: "member",
          coachAccessStatus: "demo",
        }}
      >
        <MemberProfileCard
          actorKey={mismatch ? "other:actor" : "mov115-fixture:mov115-viewer"}
          profile={{ id, displayName: "Fixture Athlete", imageUrl: null }}
        />
      </ActorProvider>
    </AuthSessionProvider>
  );
}
