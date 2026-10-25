"use client";
/* eslint-disable @next/next/no-img-element -- private revocable media must bypass the public image optimizer */
import dynamic from "next/dynamic";
import { useState } from "react";
import { Play, Images } from "lucide-react";
import { Modal } from "@/components/ui";
import {
  coachMediaVideoUrl,
  parsePublicCoachMedia,
  type CoachMediaResult,
  type PublicCoachMedia,
  type CoachMediaVideo,
} from "@/domain/coach-media";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => <p role="status">Loading video player…</p>,
});
function VideoPlayer({
  video,
  slug,
}: {
  video: CoachMediaVideo;
  slug: string | null;
}) {
  const [access, setAccess] = useState<{
    playbackId: string;
    token: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        coachMediaVideoUrl(slug, video.id, "playback"),
        { cache: "no-store", credentials: "same-origin" },
      );
      const value = await response.json();
      if (
        !response.ok ||
        value.status !== "ready" ||
        !/^[a-zA-Z0-9]{8,128}$/.test(value.playbackId) ||
        typeof value.token !== "string"
      )
        throw Error();
      setAccess({ playbackId: value.playbackId, token: value.token });
    } catch {
      setAccess(null);
      setError("This video is unavailable. Try again to check access.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="coach-media-player">
      <p>{video.description}</p>
      {access ? (
        <MuxPlayer
          playbackId={access.playbackId}
          tokens={{ playback: access.token }}
          poster={video.posterUrl}
          streamType="on-demand"
          preload="none"
          playsInline
          maxResolution="720p"
          disableTracking
          disableCookies
          onError={() => {
            setAccess(null);
            setError("Video access may have expired. Refresh to try again.");
          }}
        />
      ) : (
        <img src={video.posterUrl} alt="Video cover" />
      )}
      {error && <p role="alert">{error}</p>}
      {!access && (
        <button
          type="button"
          className="button dark"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Checking video…" : error ? "Refresh video" : "Load video"}
        </button>
      )}
      <p className="coach-media-help">
        Captions are available when processing has finished. Automatic captions
        can contain mistakes.
      </p>
    </div>
  );
}
export function CoachMediaGallery({
  media,
  slug,
}: {
  media: PublicCoachMedia;
  slug: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const index = media.photos.findIndex((p) => p.id === selectedId);
  const selected = media.photos[index];
  if (!media.photos.length && !media.video) return null;
  return (
    <div className="coach-training-media">
      <div className={`coach-media-gallery${media.video ? " has-video" : ""}`}>
        {media.video && (
          <button
            type="button"
            className="coach-media-video-cover"
            onClick={() => setVideoOpen(true)}
            aria-label={`Watch video: ${media.video.description}`}
          >
            <img
              src={media.video.posterUrl}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
            <span className="coach-media-play">
              <Play size={22} aria-hidden="true" />
            </span>
            <span className="coach-media-video-label">
              <strong>{media.video.description}</strong>
              <small>{Math.ceil(media.video.duration)} seconds</small>
            </span>
          </button>
        )}
        <div className="coach-media-photos">
          {media.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="coach-media-photo"
              aria-label={`View photo: ${photo.alt}`}
              onClick={() => setSelectedId(photo.id)}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
              />
              <span>{photo.alt}</span>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <Modal
          title={selected.alt}
          eyebrow="TRAINING PHOTOS"
          className="coach-media-lightbox"
          onClose={() => setSelectedId(null)}
        >
          <img
            className="coach-media-full-photo"
            src={selected.fullUrl}
            alt={selected.alt}
            width={selected.width}
            height={selected.height}
          />
          <div className="coach-media-actions">
            <span>
              {index + 1} of {media.photos.length}
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={media.photos.length === 1}
              onClick={() =>
                setSelectedId(
                  media.photos[
                    (index - 1 + media.photos.length) % media.photos.length
                  ].id,
                )
              }
            >
              Previous photo
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={media.photos.length === 1}
              onClick={() =>
                setSelectedId(
                  media.photos[(index + 1) % media.photos.length].id,
                )
              }
            >
              Next photo
            </button>
          </div>
        </Modal>
      )}
      {videoOpen && media.video && (
        <Modal
          title="Meet your coach"
          eyebrow="COACH INTRODUCTION"
          onClose={() => setVideoOpen(false)}
        >
          <VideoPlayer key={media.video.id} video={media.video} slug={slug} />
        </Modal>
      )}
    </div>
  );
}
export function PublicCoachMediaSection({
  slug,
  initial,
}: {
  slug: string;
  initial: CoachMediaResult<PublicCoachMedia>;
}) {
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function reload() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/coaches/${encodeURIComponent(slug)}/media`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const value = await response.json();
      if (!response.ok || value.status !== "ready") throw Error();
      setResult({ status: "ready", media: parsePublicCoachMedia(value.media) });
    } catch {
      setResult({ status: "unavailable" });
    } finally {
      setBusy(false);
    }
  }
  if (result.status === "ready" || result.status === "saved") {
    if (!result.media.photos.length && !result.media.video) return null;
    return (
      <div className="coach-about-media">
        <h3>
          <Images size={18} aria-hidden="true" /> Training with me
        </h3>
        <CoachMediaGallery media={result.media} slug={slug} />
      </div>
    );
  }
  return (
    <div className="coach-about-media">
      <h3>Training with me</h3>
      <p role="status">Training photos and video are unavailable right now.</p>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => void reload()}
      >
        {busy ? "Checking media…" : "Retry training media"}
      </button>
    </div>
  );
}
