import { coachProfileHref } from "@/domain/coach-public-url";
import Link from "next/link";
import { Eye } from "lucide-react";
import type { CoachProjection } from "@/domain/coaches";

export function CoachWorkspaceHeader({
  coach,
  ownerDisplayName,
}: {
  coach: CoachProjection | null;
  ownerDisplayName: string;
}) {
  return (
    <header className="coach-workspace-header">
      <div>
        <span className="eyebrow">COACH WORKSPACE</span>
        <h1>Run your coaching week.</h1>
        <p>
          Welcome, {ownerDisplayName}. Schedule locations, review requests and
          maintain your public presence.
        </p>
      </div>
      <div className="coach-workspace-header-actions">
        <div
          className={`coach-publication-state ${coach?.visibility ?? "missing"}`}
        >
          <span aria-hidden="true" />
          <span>
            <strong>
              {coach?.visibility === "visible"
                ? "Profile published"
                : coach
                  ? "Profile hidden"
                  : "Profile not set up"}
            </strong>
            <small>
              {coach?.visibility === "visible"
                ? "Visible in Explore"
                : coach
                  ? "Not visible in Explore"
                  : "Complete your coach profile"}
            </small>
          </span>
        </div>
        {coach?.visibility === "visible" && (
          <Link className="button secondary" href={coachProfileHref(coach)}>
            <Eye size={16} aria-hidden="true" /> View public profile
          </Link>
        )}
      </div>
    </header>
  );
}
