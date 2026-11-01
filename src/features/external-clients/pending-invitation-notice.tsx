import Link from "next/link";
import type { PendingCoachInvitation } from "@/domain/external-clients";

export function PendingInvitationNotice({
  invitation,
}: {
  invitation: PendingCoachInvitation;
}) {
  if (!invitation) return null;
  const pending = invitation.status === "pending";
  return (
    <aside className="coach-invitation-reminder" aria-label="Coach invitation">
      <div>
        <h2>
          {pending
            ? `${invitation.coachName} invited you to connect`
            : "Review your coach invitation"}
        </h2>
        <p role={pending ? undefined : "status"}>
          {pending
            ? "Your invitation is still waiting. Review and accept it to add your coach here and access your shared sessions."
            : "We couldn’t check the invitation’s current status. Open it to try again."}
        </p>
      </div>
      <Link className="button dark" href="/invitations">
        Review invitation
      </Link>
    </aside>
  );
}
