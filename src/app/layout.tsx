import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import "./club-theme.css";
import "./how-it-works.css";
import "./coming-soon.css";
import "./membership.css";
import { ActorProvider } from "@/auth/client/actor-provider";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { PreviewShell } from "@/features/preview/preview-shell";
import { initialAuthorizationState } from "@/server/authorization/service";

export const metadata: Metadata = {
  title: {
    default: "MovX Club — A membership built around your routine.",
    template: "%s | MovX Club",
  },
  description:
    "Preview one MovX Club membership across selected gyms, with clear plans and a community built on shared verified participation.",
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
            <PreviewShell>{children}</PreviewShell>
          </ActorProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
