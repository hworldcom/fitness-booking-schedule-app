"use client";
/* eslint-disable @next/next/no-img-element -- normalized public variants already have bounded dimensions; preserve runtime failure fallback */
import { useState } from "react";

export function PublicWebsiteBanner({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="coach-website-banner">
      {url && failed !== url ? (
        <img
          src={url}
          alt={`${name} coaching banner`}
          width={1600}
          height={600}
          onError={() => setFailed(url)}
          ref={(image) => {
            if (image?.complete && image.naturalWidth === 0) setFailed(url);
          }}
        />
      ) : (
        <div className="coach-website-banner-fallback">
          <span>COACHING, YOUR WAY</span>
          <p>Make space for progress.</p>
          {url && <small>Banner unavailable</small>}
        </div>
      )}
    </div>
  );
}

export function PublicWebsiteShare({
  url,
  path,
  title,
  description,
}: {
  url: string | null;
  path: string;
  title: string;
  description: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy() {
    if (!url || busy) return;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Profile link copied.");
    } catch {
      setMessage(
        "Couldn’t copy the link. Select and copy the profile address below.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!url || busy) return;
    if (!navigator.share) {
      setMessage(
        "Sharing isn’t available in this browser. Copy the profile address below.",
      );
      return;
    }
    setBusy(true);
    try {
      await navigator.share({ title, text: description, url });
      setMessage("Profile shared.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Sharing cancelled. You can still copy the link."
          : "Couldn’t share the profile. Copy the profile address below.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="coach-website-share">
      <div>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!url || busy}
        >
          Copy link
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={!url || busy}
        >
          Share profile
        </button>
      </div>
      <details>
        <summary>Profile address</summary>
        <input
          aria-label="Public profile address"
          readOnly
          value={url ?? path}
          onFocus={(e) => e.currentTarget.select()}
        />
      </details>
      <p role="status">
        {message ||
          (!url
            ? "Sharing is unavailable. You can use the profile path above."
            : "")}
      </p>
    </div>
  );
}
