import { coachProfileHref } from "@/domain/coach-public-url";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import type { CoachProjection } from "@/domain/coaches";

export function CoachWorkspaceHeader({
  coach,
  ownerDisplayName,
  view = "workspace",
  profileReturnHref = "/coach",
}: {
  coach: CoachProjection | null;
  ownerDisplayName: string;
  view?: "workspace" | "profile";
  profileReturnHref?: "/coach" | "/profile";
}) {
  return (
    <header className="coach-workspace-header">
      <div>
        <span className="eyebrow">
          {view === "profile" ? "YOUR COACH PROFILE" : "COACH WORKSPACE"}
        </span>
        <h1>{view === "profile" ? "Profile." : "Run your coaching week."}</h1>
        <p>
          {view === "profile"
            ? `Welcome, ${ownerDisplayName}. Manage your coaching identity, photos and training locations.`
            : `Welcome, ${ownerDisplayName}. Schedule locations, review requests and maintain your public presence.`}
        </p>
        {view === "profile" && (
          <Link className="button secondary" href={profileReturnHref}>
            <ArrowLeft size={16} aria-hidden="true" />
            {profileReturnHref === "/coach"
              ? "Coach workspace"
              : "Personal profile"}
          </Link>
        )}
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
