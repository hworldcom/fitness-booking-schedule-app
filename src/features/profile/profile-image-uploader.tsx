"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { Avatar } from "@/components/ui";
import {
  isProfileImageMutationSnapshot,
  PROFILE_IMAGE_MIME_TYPE,
} from "@/profile-images/contracts";
import {
  BrowserProfileImageError,
  normalizeProfileImageInBrowser,
} from "@/profile-images/browser-normalization";
import { accountProfileImagePresentation } from "@/profile-images/presentation";

type UploadStatus = "idle" | "working" | "saved" | "removed" | "error";

export function ProfileImageUploader({
  endpoint,
  currentImageUrl,
  fallbackImageUrl = null,
  displayName,
  initials,
  kind,
}: {
  endpoint: "/api/profile/avatar" | "/api/coach/portrait";
  currentImageUrl: string | null;
  fallbackImageUrl?: string | null;
  displayName: string;
  initials: string;
  kind: "account" | "coach";
}) {
  const { refreshActor } = useActor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(currentImageUrl);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const working = status === "working";
  const coach = kind === "coach";
  const presentation = coach
    ? { imageUrl, source: imageUrl ? ("coach" as const) : null }
    : accountProfileImagePresentation(imageUrl, fallbackImageUrl);
  const detectedCoachPortrait = !coach && presentation.source === "coach";

  async function reconcileSuccess(nextImageUrl: string | null) {
    setImageUrl(nextImageUrl);
    await refreshActor();
  }

  async function upload(file: File) {
    setStatus("working");
    setMessage("Preparing your image…");
    try {
      const body = await normalizeProfileImageInBrowser(file);
      setMessage("Uploading your image…");
      const response = await fetch(endpoint, {
        method: "POST",
        body,
        headers: { "content-type": PROFILE_IMAGE_MIME_TYPE },
      });
      const value: unknown = await response.json();
      if (!isProfileImageMutationSnapshot(value) || value.status !== "saved") {
        throw new BrowserProfileImageError(
          value &&
            typeof value === "object" &&
            "status" in value &&
            value.status === "conflict"
            ? "The image changed in another tab. Refresh and try again."
            : "The image could not be saved. Your previous image is unchanged.",
        );
      }
      await reconcileSuccess(value.imageUrl);
      setStatus("saved");
      setMessage(
        coach ? "Public coach portrait saved." : "Account avatar saved.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof BrowserProfileImageError
          ? error.message
          : "The image could not be saved. Your previous image is unchanged.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setStatus("working");
    setMessage("Removing the image…");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const value: unknown = await response.json();
      if (
        !isProfileImageMutationSnapshot(value) ||
        value.status !== "removed"
      ) {
        throw new Error("remove failed");
      }
      await reconcileSuccess(null);
      setStatus("removed");
      setMessage(
        coach
          ? "Public coach portrait removed. Initials are shown instead."
          : fallbackImageUrl
            ? "Account avatar removed. Your public coach portrait is shown instead."
            : "Account avatar removed. Initials are shown instead.",
      );
    } catch {
      setStatus("error");
      setMessage("The image could not be removed. Try again.");
    }
  }

  return (
    <section
      className="profile-image-uploader"
      aria-labelledby={`${kind}-image-title`}
    >
      <div className="profile-image-uploader-preview">
        <Avatar
          initials={initials}
          imageUrl={presentation.imageUrl}
          alt={
            presentation.source === "coach"
              ? `${displayName} ${coach ? "coach portrait" : "public coach portrait"}`
              : presentation.source === "account"
                ? `${displayName} account avatar`
                : ""
          }
        />
      </div>
      <div className="profile-image-uploader-content">
        <span className="eyebrow">
          {coach ? "PUBLIC COACH PORTRAIT" : "PRIVATE ACCOUNT AVATAR"}
        </span>
        <h2 id={`${kind}-image-title`}>
          {coach
            ? "Choose your discovery portrait"
            : "Choose your account picture"}
        </h2>
        <p>
          {coach
            ? "Shown publicly in coach discovery while your coach profile is visible. It is separate from your private account avatar."
            : detectedCoachPortrait
              ? "Your public coach portrait was detected and is shown here as a fallback. Choosing an account picture creates a separate private avatar."
              : "Shown only on signed-in account surfaces. It is not reused as your public coach portrait."}
        </p>
        <small>
          JPEG, PNG or WebP up to 8 MB. MovX center-crops, compresses and stores
          one 512 × 512 WebP copy.
        </small>
        <div className="profile-image-uploader-actions">
          <label className={`button dark ${working ? "disabled" : ""}`}>
            {working ? (
              <LoaderCircle
                className="profile-image-spinner"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <ImagePlus size={16} aria-hidden="true" />
            )}
            {imageUrl ? "Replace image" : "Choose image"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={working}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {imageUrl && (
            <button
              type="button"
              className="button secondary"
              disabled={working}
              onClick={() => void remove()}
            >
              <Trash2 size={16} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        {status !== "idle" && (
          <p
            className={`profile-image-uploader-status ${status}`}
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
