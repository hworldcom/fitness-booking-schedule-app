import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { loadConnectionPagesAction } from "@/app/connections/actions";
import { ConnectionWorkspace } from "@/features/connections/connection-workspace";
import "@/features/connections/connections.css";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentClientSessionWorkspace } from "@/server/coaches/booking-request-service";
import { connectionWorkspaceVersion } from "@/server/connections/workspace-version";

export const metadata: Metadata = { title: "My coaches" };

export default async function Page() {
  const access = await protectedPageAccess("/my-coaches");
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  if (access.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY COACHES</span>
        <h1>Sign in to see your coaches.</h1>
        <p>
          Your connections and connection requests are private to your account.
        </p>
        <Link href={signInHref("/my-coaches")} className="button dark">
          Go to sign-in
        </Link>
      </section>
    );
  }

  const [workspace, pages] = await Promise.all([
    currentClientSessionWorkspace({ pageSize: 20 }),
    loadConnectionPagesAction("athlete"),
  ]);
  if (workspace.status === "signed-out") redirect(signInHref("/my-coaches"));
  if (workspace.status === "forbidden")
    redirect(`${signInHref("/my-coaches")}&reason=forbidden`);
  if (workspace.status !== "authorized") return <ProtectedAccessUnavailable />;

  return (
    <div className="client-session-workspace my-coaches-page">
      <ConnectionWorkspace
        key={workspace.actorScope}
        role="athlete"
        view="connections"
        mayInitiate={true}
        initialPages={pages}
        sourceVersion={connectionWorkspaceVersion(
          workspace.actorScope,
          "athlete",
          [pages, workspace.bookings],
        )}
        bookings={workspace.bookings}
        referenceTime={new Date().toISOString()}
      />
    </div>
  );
}
