import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bricolage-grotesque";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./club-theme.css";
import "./authenticated-workspace.css";
import "./client-sessions-workspace.css";
import "./workspace-section-navigation.css";
import "./my-sessions-navigation.css";
import "./coming-soon.css";
import "./coach-story.css";
import "./coach-discovery.css";
import "./coach-workspace.css";
import "./explore-discovery.css";
import "@/features/messages/messages.css";
import "@/features/reviews/reviews.css";
import "./account-menu.css";
import "./notifications.css";
import "./account-settings.css";
import "./authentication.css";
import "./public-marketplace-accessibility.css";
import "./coach-directory-cards.css";
import "@/features/coaches/website/public-coach-website.css";
import "./public-page-theme.css";
import { ActorProvider } from "@/auth/client/actor-provider";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { Shell } from "@/components/shell";
import { initialAuthorizationState } from "@/server/authorization/service";

export const metadata: Metadata = {
  title: {
    default: "MovX Club — Find training. Build your routine.",
    template: "%s | MovX Club",
  },
  description:
    "Find coaches and group sessions, build your workout routine and track your activity in one personal calendar.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session: initialSession, actor: initialActor } =
    await initialAuthorizationState();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthSessionProvider initialSession={initialSession}>
          <ActorProvider initialActor={initialActor}>
            <Shell>{children}</Shell>
          </ActorProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
