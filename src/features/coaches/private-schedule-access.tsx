"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, LockKeyhole } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { signInHref } from "@/auth/return-to";
import type { PrivateScheduleSummary } from "@/domain/private-schedule-summary";
import { publicScheduleActorMatches } from "./public-schedule-model";
import { coachRedirectHref } from "@/domain/coach-public-url";
import { publicScheduleDateLabel } from "./public-schedule-model";

export function PrivateScheduleAccess({
  expected,
  summary,
  returnTo,
  children,
}: {
  expected: { subject: string; actorIdentity: string } | null;
  summary: PrivateScheduleSummary;
  returnTo: string;
  children?: ReactNode;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  if (expected && publicScheduleActorMatches(session, actor, expected))
    return children;
  const signedIn = session.status === "signed-in";
  return (
    <section
      id="private-schedule"
      tabIndex={-1}
      className="coach-private-schedule-preview"
      aria-labelledby="private-schedule-preview-title"
    >
      <span className="eyebrow">
        <CalendarDays size={18} aria-hidden="true" /> PRIVATE SESSIONS
      </span>
      <h2 id="private-schedule-preview-title">Make time for your next step.</h2>
      {summary.status === "ready" ? (
        <p className="coach-private-schedule-count" role="status">
          <strong>{summary.count}</strong>
          <span>
            {summary.count === 1 ? "open slot" : "open slots"}
            <br />
            in the next 7 days
          </span>
        </p>
      ) : (
        <p role="status">We couldn’t verify open slots. Please try again.</p>
      )}
      {summary.status === "ready" && (
        <nav
          className="public-schedule-dates coach-private-schedule-days"
          aria-label="Open slots over the next seven days"
        >
          {summary.days.map((day) => {
            const target = coachRedirectHref(
              returnTo.split("?")[0].split("#")[0],
              { date: day.date, section: "private-schedule" },
            );
            return (
              <Link
                key={day.date}
                href={signedIn ? target : signInHref(target)}
                prefetch={false}
                aria-label={`${publicScheduleDateLabel(day.date, true)}: ${day.count} open ${day.count === 1 ? "slot" : "slots"}. ${signedIn ? "Reload schedule" : "Sign in to view times"}`}
              >
                <time dateTime={day.date}>
                  {publicScheduleDateLabel(day.date, true)}
                </time>
                <small>
                  {day.count} open {day.count === 1 ? "slot" : "slots"}
                </small>
              </Link>
            );
          })}
        </nav>
      )}
      <p>Sign in to see the times under each day and choose your session.</p>
      <Link
        className="button dark"
        href={signedIn ? returnTo : signInHref(returnTo)}
        prefetch={false}
      >
        <LockKeyhole size={16} aria-hidden="true" />
        {signedIn ? "Reload schedule" : "Sign in to view schedule"}
      </Link>
      {summary.status === "unavailable" && !signedIn && (
        <Link
          className="coach-private-schedule-retry"
          href={returnTo}
          prefetch={false}
        >
          Retry availability
        </Link>
      )}
      {summary.status === "ready" && (
        <p className="coach-website-note">
          Slots are available session start times. Booking one may affect other
          times.
        </p>
      )}
    </section>
  );
}
