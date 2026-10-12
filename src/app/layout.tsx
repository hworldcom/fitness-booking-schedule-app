import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bricolage-grotesque";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./club-theme.css";
import "./authenticated-workspace.css";
import "./client-sessions-workspace.css";
import "./coming-soon.css";
import "./coach-story.css";
import "./coach-discovery.css";
import "./coach-workspace.css";
import { ActorProvider } from "@/auth/client/actor-provider";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { Shell } from "@/components/shell";
import { initialAuthorizationState } from "@/server/authorization/service";

export const metadata: Metadata = {
  title: {
    default: "MovX Club — Find your coach.",
    template: "%s | MovX Club",
  },
  description:
    "Discover martial-arts coaches, compare real published availability and request coach-confirmed private sessions.",
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
    <html lang="en">
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
