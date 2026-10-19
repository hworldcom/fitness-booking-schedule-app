"use client";
import Link from "next/link";
import { useState } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import type { CoachProjection } from "@/domain/coaches";
import { isProfileImageMutationSnapshot } from "@/profile-images/contracts";
import { ProfileImageUploader } from "@/features/profile/profile-image-uploader";

export function CoachPictureSettings({
  coach,
  publicationAllowed,
  onImageChange,
}: {
  coach: CoachProjection;
  publicationAllowed: boolean;
  onImageChange: (imageUrl: string | null) => void;
}) {
  const { actor, refreshActor } = useActor();
  const scope =
    actor.status === "authorized"
      ? `${actor.demoRun.slug}:${actor.profile.slug}`
      : null;
  const [initialScope] = useState(scope);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{
    error: boolean;
    message: string;
  } | null>(null);
  const shared =
    coach.portraitUrl?.startsWith(
      `/api/coaches/portraits/${coach.profileId}?`,
    ) ?? false;
  const accountPicture =
    actor.status === "authorized" ? actor.profile.avatarUrl : null;
  if (!scope || scope !== initialScope)
    return <p role="status">Reload your coach page to check picture access.</p>;

  async function select(enabled: boolean) {
    if (working) return;
    setWorking(true);
    setResult(null);
    try {
      const response = await fetch("/api/coach/portrait/account", {
        method: enabled ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: coach.profileId }),
      });
      const value: unknown = await response.json();
      if (
        !response.ok ||
        !isProfileImageMutationSnapshot(value) ||
        value.status !== (enabled ? "saved" : "removed")
      )
        throw new Error(
          "The picture choice could not be verified. Reload the coach page to check it before trying again.",
        );
      onImageChange(value.imageUrl);
      await refreshActor();
      setResult({
        error: false,
        message: enabled
          ? "Your account picture is now used for your coach profile and previews."
          : "Your account picture is no longer used for your coach profile. Your account picture is unchanged.",
      });
    } catch (error) {
      setResult({
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "The picture choice could not be saved. Try again.",
      });
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="coach-picture-settings">
      <section
        className="profile-image-uploader"
        aria-labelledby="coach-picture-choice-title"
      >
        <div className="profile-image-uploader-preview">
          <Avatar
            initials={profileInitials(coach.displayName)}
            imageUrl={shared ? coach.portraitUrl : accountPicture}
            alt={
              accountPicture || shared
                ? `${coach.displayName} ${shared ? "shared coach picture" : "account picture"}`
                : ""
            }
          />
        </div>
        <div className="profile-image-uploader-content">
          <span className="eyebrow">COACH PICTURE</span>
          <h2 id="coach-picture-choice-title">
            {shared
              ? "One picture for your account and coaching"
              : "Use your account picture for coaching"}
          </h2>
          <p>
            {shared
              ? "Changing or removing your account picture also updates your coach picture."
              : "Use the picture you already uploaded, or keep a separate coach portrait."}{" "}
            Your coach picture stays private while your application is under
            review. It becomes public only when your approved coach profile is
            published.
          </p>
          {!accountPicture && (
            <p>
              Add an account picture in your personal profile to use it here.
            </p>
          )}
          <div className="profile-image-uploader-actions">
            {shared ? (
              <>
                <Link className="button dark" href="/profile">
                  Change account picture
                </Link>
                <button
                  className="button secondary"
                  type="button"
                  disabled={working}
                  onClick={() => void select(false)}
                >
                  {working ? "Saving…" : "Stop using account picture"}
                </button>
              </>
            ) : (
              <button
                className="button dark"
                type="button"
                disabled={working || !accountPicture}
                onClick={() => void select(true)}
              >
                {working ? "Saving…" : "Use my account picture"}
              </button>
            )}
            {!shared && (
              <Link className="button secondary" href="/profile">
                {accountPicture
                  ? "Change account picture"
                  : "Add account picture"}
              </Link>
            )}
          </div>
          {result && (
            <p
              className={`profile-image-uploader-status ${result.error ? "error" : "saved"}`}
              role={result.error ? "alert" : "status"}
              aria-live="polite"
            >
              {result.message}
            </p>
          )}
        </div>
      </section>
      {publicationAllowed && !shared && (
        <ProfileImageUploader
          key={coach.profileId}
          endpoint="/api/coach/portrait"
          currentImageUrl={coach.portraitUrl}
          displayName={coach.displayName}
          initials={profileInitials(coach.displayName)}
          kind="coach"
          onImageChange={onImageChange}
        />
      )}
    </div>
  );
}
