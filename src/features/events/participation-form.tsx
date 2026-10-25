"use client";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { GroupRegistration, GroupSession } from "@/domain/group-sessions";
import { submitGroupParticipationAction } from "@/app/events/actions";
import {
  eventHref,
  registrationStatus,
  unavailableJoinReason,
} from "./event-contract";

export function ParticipationForm({
  session,
  registration,
  scope,
  joinId,
  history = false,
}: {
  session: GroupSession;
  registration: GroupRegistration | null;
  scope: string;
  joinId: string;
  history?: boolean;
}) {
  const permalink = eventHref(session);
  const active =
    registration?.status === "active" || registration?.status === "pending";
  const mayWithdraw = active && registration.canWithdraw;
  const mayJoin = !history && !active && session.canJoin;
  return (
    <div className="event-participation">
      {!history && <h2>Your place</h2>}
      {registration && (
        <p className="event-registration-state" role="status">
          <strong>{registrationStatus(registration)}</strong>
        </p>
      )}
      {registration?.status === "pending" && (
        <p>
          Your seat is held while the coach reviews your request. Participation
          approval and event confirmation are separate. Pending requests expire
          at the registration deadline.
        </p>
      )}
      {registration?.status === "declined" && (
        <p>
          The coach declined your participation. You cannot reapply to this
          event.
        </p>
      )}
      {registration?.status === "approval-expired" && (
        <p>
          The coach did not approve your request before the deadline. Your seat
          has been released.
        </p>
      )}
      {registration?.status === "active" && (
        <p>
          {session.displayStatus === "open"
            ? "Your participation is approved. The coach has not yet confirmed this session. Check the status here before travelling."
            : session.displayStatus === "confirmed"
              ? "Your participation is approved and the coach has confirmed the session."
              : "Your registration is retained in your history. Ended does not confirm attendance."}
        </p>
      )}
      {mayJoin && (
        <p>
          {session.status === "open"
            ? "Request one seat, subject to individual coach approval. The coach will separately decide whether this session runs; reaching the minimum does not confirm it automatically."
            : "Request one seat in this coach-confirmed session. You still need individual coach approval."}
        </p>
      )}
      {!history && !active && !mayJoin && (
        <p>{unavailableJoinReason(session)}</p>
      )}
      {mayWithdraw && (
        <p>
          You can withdraw until the session starts. A confirmed session stays
          confirmed after a withdrawal unless the coach cancels it.
        </p>
      )}
      {(mayJoin || mayWithdraw) && (
        <form action={submitGroupParticipationAction}>
          <input
            type="hidden"
            name="intent"
            value={mayWithdraw ? "withdraw" : "join"}
          />
          <input type="hidden" name="sessionId" value={session.id} />
          <input
            type="hidden"
            name="registrationId"
            value={mayWithdraw ? registration.id : joinId}
          />
          <input type="hidden" name="actorScope" value={scope} />
          <ParticipationButton withdraw={!!mayWithdraw} />
        </form>
      )}
      {!history && (
        <p>
          <a href={permalink}>Refresh session status</a>
        </p>
      )}
      {!history && (
        <Link href="/sessions/groups" className="event-history-link">
          My group registrations
        </Link>
      )}
    </div>
  );
}

function ParticipationButton({ withdraw }: { withdraw: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`button ${withdraw ? "secondary" : "dark"}`}
      disabled={pending}
    >
      {pending
        ? "Checking registration…"
        : withdraw
          ? "Withdraw my seat"
          : "Request a seat"}
    </button>
  );
}
