import Link from "next/link";
import type { ReactNode } from "react";
import { Eye, Settings2 } from "lucide-react";
import type { CoachProjection } from "@/domain/coaches";
import type { CoachWorkspaceView } from "./coach-workspace-view";
import { CoachWorkspaceHeader } from "./coach-workspace-header";

export function CoachAvailabilityPanel({
  coach,
  view,
  bookingContent,
  ownerDisplayName,
  scheduleContent,
  allowScheduleHistory = false,
}: {
  coach: CoachProjection | null;
  view: CoachWorkspaceView;
  bookingContent?: ReactNode;
  ownerDisplayName: string;
  scheduleContent?: ReactNode;
  allowScheduleHistory?: boolean;
}) {
  return (
    <div className="coach-workspace">
      <CoachWorkspaceHeader coach={coach} ownerDisplayName={ownerDisplayName} />

      {view === "bookings" && coach ? (
        bookingContent
      ) : !coach ? (
        <section className="coach-workspace-gate">
          <Settings2 size={27} aria-hidden="true" />
          <span className="eyebrow">PROFILE REQUIRED</span>
          <h2>Create your coach profile first.</h2>
          <p>
            Your availability needs a reviewed timezone and a confirmed public
            training venue.
          </p>
          <Link className="button dark" href="/profile/coach">
            Set up coach profile
          </Link>
        </section>
      ) : coach.visibility !== "visible" && !allowScheduleHistory ? (
        <section className="coach-workspace-gate">
          <Eye size={27} aria-hidden="true" />
          <span className="eyebrow">PROFILE HIDDEN</span>
          <h2>Publish your profile before offering times.</h2>
          <p>
            Hidden coaches cannot create public availability. Existing sessions
            remain stored.
          </p>
          <Link className="button dark" href="/profile/coach">
            Review profile visibility
          </Link>
        </section>
      ) : (
        scheduleContent
      )}
    </div>
  );
}
