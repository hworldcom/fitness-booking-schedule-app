import {
  myCoachesSection,
  myCoachesHref,
} from "@/domain/my-coaches-navigation";
import { MyCoachesWorkspace } from "@/features/connections/my-coaches-workspace";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { loadConnectionPagesAction } from "@/app/connections/actions";
import { ConnectionWorkspace } from "@/features/connections/connection-workspace";
import "@/features/connections/connections.css";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentAthleteCoachWorkspace } from "@/server/connections/athlete-coaches-service";
import { AthleteCoachRoster } from "@/features/connections/athlete-coach-roster";
import { isAthleteCoachFilter } from "@/domain/athlete-coaches";
import { connectionWorkspaceVersion } from "@/server/connections/workspace-version";
import { currentPendingCoachInvitation } from "@/server/external-clients/pending-invitation";
import { PendingInvitationNotice } from "@/features/external-clients/pending-invitation-notice";

export const metadata: Metadata = { title: "My coaches" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const section = myCoachesSection(params.section);
  const filter = isAthleteCoachFilter(params.status) ? params.status : "all";
  const returnHref = myCoachesHref(section, filter);
  const access = await protectedPageAccess(returnHref);
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  if (access.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY COACHES</span>
        <h1>Sign in to see your coaches.</h1>
        <p>
          Your connections and connection requests are private to your account.
        </p>
        <Link href={signInHref(returnHref)} className="button dark">
          Go to sign-in
        </Link>
      </section>
    );
  }

  const [workspace, pages, invitation] = await Promise.all([
    currentAthleteCoachWorkspace(section === "connected" ? filter : null),
    section === "requests"
      ? loadConnectionPagesAction("athlete", "requests")
      : null,
    currentPendingCoachInvitation(),
  ]);
  if (workspace.status === "signed-out") redirect(signInHref(returnHref));
  if (workspace.status === "forbidden")
    redirect(`${signInHref(returnHref)}&reason=forbidden`);
  if (workspace.status !== "authorized") return <ProtectedAccessUnavailable />;

  const scope = [workspace.subject, workspace.actorIdentity].join(":");
  return (
    <MyCoachesWorkspace
      key={`${scope}:${section}:${filter}`}
      active={section}
      subject={workspace.subject}
      actorIdentity={workspace.actorIdentity}
      filter={filter}
    >
      <PendingInvitationNotice invitation={invitation} />
      {section === "connected" ? (
        <AthleteCoachRoster
          scope={workspace.scope}
          filter={filter}
          initialPage={workspace.page}
        />
      ) : (
        <ConnectionWorkspace
          key={`${scope}:${section}`}
          role="athlete"
          view="connections"
          connectionView={section}
          connectionHeadingLevel={2}
          mayInitiate={true}
          initialPages={pages!}
          sourceVersion={connectionWorkspaceVersion(scope, "athlete", [
            section,
            pages,
          ])}
          bookings={null}
          referenceTime={new Date().toISOString()}
        />
      )}
    </MyCoachesWorkspace>
  );
}
