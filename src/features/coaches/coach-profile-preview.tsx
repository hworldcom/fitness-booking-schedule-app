import { Eye, EyeOff, MapPin } from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";
import type { CoachProjection } from "@/domain/coaches";

export function CoachProfilePreview({
  coach,
  publicationAllowed,
}: {
  coach: CoachProjection;
  publicationAllowed: boolean;
}) {
  const activeLocations = coach.locations.filter(
    (location) => location.status === "active",
  );
  const primary = activeLocations.find(
    (location) => location.id === coach.primaryLocationId,
  );
  const otherLocationCount = Math.max(0, activeLocations.length - 1);
  const publiclyVisible = publicationAllowed && coach.visibility === "visible";

  return (
    <aside className="coach-profile-preview" aria-label="Coach profile preview">
      <div className="coach-profile-preview-label">
        <span className="eyebrow">
          {publicationAllowed ? "PUBLIC PREVIEW" : "PRIVATE DRAFT PREVIEW"}
        </span>
        <span className={publiclyVisible ? "visible" : "hidden"}>
          {publiclyVisible ? (
            <Eye size={13} aria-hidden="true" />
          ) : (
            <EyeOff size={13} aria-hidden="true" />
          )}
          {publiclyVisible ? "Published" : "Not public"}
        </span>
      </div>
      <div className="coach-profile-preview-media">
        <Avatar
          initials={profileInitials(coach.displayName)}
          imageUrl={coach.portraitUrl}
          alt={coach.portraitUrl ? `${coach.displayName} coach portrait` : ""}
        />
      </div>
      <div className="coach-profile-preview-body">
        <div className="coach-profile-preview-disciplines">
          {coach.disciplines.map((discipline) => (
            <span key={discipline}>{discipline}</span>
          ))}
        </div>
        <h2>{coach.displayName}</h2>
        <p>{coach.bio}</p>
        <dl>
          <div>
            <dt>
              <MapPin size={14} aria-hidden="true" /> Primary location
            </dt>
            <dd>{primary?.publicName ?? "Primary location unavailable"}</dd>
          </div>
          <div>
            <dt>Other active places</dt>
            <dd>{otherLocationCount}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
