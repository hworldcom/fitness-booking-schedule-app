"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import { submitCoachApplication } from "@/auth/client/coach-application-client";
import type { CoachAccessProjection } from "@/domain/coaches";

function ApplicationButton({ resubmit = false }: { resubmit?: boolean }) {
  const router = useRouter();
  const actionLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    setError(null);
    const result = await submitCoachApplication();
    if (result.status === "pending" || result.status === "approved") {
      router.replace("/profile/coach");
      router.refresh();
      return;
    }
    setError(
      result.status === "signed-out"
        ? "Your sign-in expired. Sign in again before applying to coach."
        : result.status === "forbidden"
          ? "This account cannot submit a coach application in the current workspace."
          : result.status === "suspended"
            ? "This coach application is suspended and requires platform review."
            : "MovX could not submit the coach application right now. Try again shortly.",
    );
    actionLock.current = false;
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        className="button dark"
        disabled={pending}
        onClick={() => void submit()}
      >
        <Send size={17} aria-hidden="true" />
        {pending
          ? resubmit
            ? "Resubmitting…"
            : "Submitting…"
          : resubmit
            ? "Resubmit application"
            : "Apply to become a coach"}
      </button>
      {error && (
        <p className="coach-activation-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function CoachApplicationGate({
  access,
  existingBookings,
}: {
  access: CoachAccessProjection;
  existingBookings?: ReactNode;
}) {
  const isPending = access.status === "pending";
  const isRejected = access.status === "rejected";
  const isSuspended = access.status === "suspended";

  return (
    <>
      <section className="coach-workspace-gate coach-activation-gate">
        {isSuspended ? (
          <ShieldAlert size={28} aria-hidden="true" />
        ) : isPending ? (
          <Clock3 size={28} aria-hidden="true" />
        ) : (
          <BadgeCheck size={28} aria-hidden="true" />
        )}
        <span className="eyebrow">
          {isSuspended
            ? "COACH ACCESS SUSPENDED"
            : isPending
              ? "APPLICATION PENDING"
              : isRejected
                ? "APPLICATION NEEDS CHANGES"
                : "BECOME A COACH"}
        </span>
        <h1>
          {isSuspended
            ? "New coaching activity is paused."
            : isPending
              ? "MovX is reviewing your coach application."
              : isRejected
                ? "Update your coach draft before applying again."
                : "Apply before publishing coaching."}
        </h1>
        <p>
          {isSuspended
            ? (access.decisionReason ??
              "Your coach profile is hidden and cannot accept new bookings. Existing sessions remain available in Bookings.")
            : isPending
              ? "You can prepare a private coach-profile draft while you wait. Publishing and availability unlock only after approval."
              : isRejected
                ? (access.decisionReason ??
                  "Review your private draft, make the requested changes and resubmit it for platform review.")
                : "Client booking is already available on this account. Coach publication and scheduling require a separate MovX review."}
        </p>
        <div className="coach-activation-actions">
          {access.status === "not-applied" && <ApplicationButton />}
          {isRejected && <ApplicationButton resubmit />}
          {(isPending || isRejected) && (
            <Link className="button secondary" href="/profile/coach">
              Edit private coach draft
            </Link>
          )}
          {isSuspended && !existingBookings && (
            <Link className="button secondary" href="/coach?view=bookings">
              <CalendarDays size={17} aria-hidden="true" /> View bookings
            </Link>
          )}
          <Link className="button secondary" href="/explore">
            <Search size={17} aria-hidden="true" /> Find a coach
          </Link>
        </div>
      </section>
      {existingBookings}
    </>
  );
}

export function CoachApplicationBanner({
  access,
}: {
  access: CoachAccessProjection;
}) {
  if (access.status !== "pending" && access.status !== "rejected") return null;
  return (
    <section className="coach-application-banner" role="status">
      <div>
        <strong>
          {access.status === "pending"
            ? "Application pending review"
            : "Application changes requested"}
        </strong>
        <p>
          {access.status === "pending"
            ? "This profile remains a private draft until MovX approves the application."
            : (access.decisionReason ??
              "Update the private profile and resubmit it for review.")}
        </p>
      </div>
      {access.status === "rejected" && <ApplicationButton resubmit />}
    </section>
  );
}
