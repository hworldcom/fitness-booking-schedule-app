import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { parseGroupSessionResult } from "@/domain/group-sessions";
import {
  eventHref,
  eventIssueMessage,
  eventIdFromSlug,
  unavailableJoinReason,
} from "@/features/events/event-contract";
import {
  EventStatus,
  EventTerms,
  EventsUnavailable,
} from "@/features/events/event-ui";
import { ParticipationForm } from "@/features/events/participation-form";
import { athleteEventDetail } from "@/server/group-sessions/athlete-service";
import { publicGroupSessions } from "@/server/group-sessions/service";
import "@/features/events/events.css";

export const metadata: Metadata = { title: "Group session" };
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ issue?: string | string[] }>;
}) {
  const { slug } = await params;
  const issue = eventIssueMessage((await searchParams).issue);
  const id = eventIdFromSlug(slug);
  if (!id) notFound();
  const [publicState, viewer] = await Promise.all([
    publicGroupSessions({ action: "detail", args: { slug } }),
    athleteEventDetail(id),
  ]);
  const publicSession =
    publicState.status === "ready"
      ? parseGroupSessionResult("public-detail", publicState.value).session
      : null;
  const privateDetail = viewer.status === "ready" ? viewer.value : null;
  const session = privateDetail?.session ?? publicSession;
  if (!session) {
    if (publicState.status === "unavailable" || viewer.status === "unavailable")
      return (
        <div className="events-page">
          <EventsUnavailable href={`/events/${slug}`} />
        </div>
      );
    notFound();
  }
  if (session.status === "draft") notFound();
  const href = eventHref(session);
  return (
    <div className="events-page event-detail-page">
      <Link className="event-back" href="/events">
        ← All group sessions
      </Link>
      <header className="events-heading">
        <span className="eyebrow">{session.discipline} · GROUP SESSION</span>
        <h1>{session.title}</h1>
        <EventStatus session={session} />
        <p>
          With{" "}
          {publicSession ? (
            <Link href={`/coaches/${session.coach.slug}`}>
              {session.coach.name}
            </Link>
          ) : (
            session.coach.name
          )}
          {session.coach.trustKind && (
            <>
              {" "}
              ·{" "}
              {session.coach.trustKind === "demo"
                ? "Demo coach"
                : "Verified coach"}
            </>
          )}
        </p>
      </header>
      {issue && (
        <section className="event-action-result" role="alert">
          <p>{issue}</p>
          <a href={href}>Reload current session status</a>
        </section>
      )}
      <div className="event-detail-layout">
        <section className="event-detail-content" aria-label="Session details">
          <h2>About this session</h2>
          <p className="event-description">
            {session.description || "The coach has not added a description."}
          </p>
          <EventTerms session={session} />
          <p className="events-footnote">
            Published session details are fixed. For paid sessions, the coach
            collects at the venue; MovX does not collect or verify payment.
            Ended is a time-based label, not proof of attendance.
          </p>
        </section>
        <aside className="event-booking-panel" aria-label="Your registration">
          {viewer.status === "ready" && privateDetail ? (
            <ParticipationForm
              session={session}
              registration={privateDetail.registration}
              scope={viewer.scope}
              joinId={randomUUID()}
            />
          ) : viewer.status === "signed-out" || viewer.status === "preview" ? (
            <>
              <h2>
                {session.canJoin ? "Join the training" : "Registration closed"}
              </h2>
              {session.canJoin ? (
                <>
                  <p>
                    Sign in to reserve one seat. Signing in alone does not join
                    this session.
                  </p>
                  <Link className="button dark" href={signInHref(href)}>
                    Sign in to join
                  </Link>
                </>
              ) : (
                <p>{unavailableJoinReason(session)}</p>
              )}
            </>
          ) : (
            <>
              <h2>Registration unavailable</h2>
              <p>
                MovX could not verify your registration permissions. No join
                action is available until your account and session status can be
                checked.
              </p>
              <a href={href} className="button secondary">
                Refresh session status
              </a>
            </>
          )}
        </aside>
      </div>
      <p className="events-footnote">
        Check your session status in MovX before travelling. Notifications and
        reminders are not provided.
      </p>
    </div>
  );
}
