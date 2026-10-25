"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import {
  COACH_MEDIA_PHOTO_BYTES,
  COACH_MEDIA_VIDEO_PREFLIGHT_BYTES,
  validMediaDescription,
  parseOwnedCoachMedia,
  type OwnedCoachMedia,
} from "@/domain/coach-media";
import { CoachMediaGallery } from "./coach-media-gallery";
import type { UpChunk } from "@mux/upchunk";
import "./coach-media.css";

export function CoachMediaEditor() {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const scope =
    session.status === "signed-in" &&
    actor.status === "authorized" &&
    ["approved", "demo", "pending", "rejected"].includes(
      actor.coachAccessStatus,
    )
      ? `${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}:${actor.coachAccessStatus}`
      : null;
  return scope ? (
    <ScopedCoachMediaEditor key={scope} />
  ) : (
    <p role="status">Reload your profile to verify media editing access.</p>
  );
}
function ScopedCoachMediaEditor() {
  const descriptionId = useId();
  const [media, setMedia] = useState<OwnedCoachMedia | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const fence = useRef(0);
  const disposed = useRef(false);
  const upload = useRef<UpChunk | null>(null);
  const abort = useRef<AbortController | null>(null);
  const transferGeneration = useRef(0);
  const cancelPromise = useRef<(() => void) | null>(null);
  const dirty =
    media &&
    JSON.stringify({
      photos: media.photos.map((p) => p.id),
      video: media.video?.id,
    }) !==
      JSON.stringify({
        photos: media.published.photos.map((p) => p.id),
        video: media.published.video?.id,
      });
  const active = !!media?.uploads.some((u) =>
    ["reserved", "creating", "uploading", "processing"].includes(u.status),
  );
  function accessLost() {
    upload.current?.abort();
    abort.current?.abort();
    setMedia(null);
    setFile(null);
    setDescription("");
    setPendingId(null);
  }
  async function receive(response: Response, request: number) {
    const value = await response.json();
    if (disposed.current || request !== fence.current) return null;
    if (response.status === 401 || response.status === 403) {
      accessLost();
      throw Error("Media access is no longer available. Reload your profile.");
    }
    if (!response.ok || !["ready", "saved"].includes(value.status))
      throw Error(
        response.status === 409
          ? "Your media changed or reached its limit. Reload and review the latest draft before trying again."
          : response.status === 400
            ? "Check the file, description and upload limits, then try again."
            : "We couldn’t confirm this change. Reload media to check its saved state before retrying.",
      );
    const next = parseOwnedCoachMedia(value.media);
    setMedia(next);
    return next;
  }
  async function load() {
    const request = ++fence.current;
    try {
      await receive(
        await fetch("/api/coach/media", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        request,
      );
      if (!disposed.current && request === fence.current) setMessage("");
    } catch (error) {
      if (!disposed.current && request === fence.current)
        setMessage((error as Error).message);
    }
  }
  function disposeTransfers() {
    disposed.current = true;
    fence.current++;
    transferGeneration.current++;
    cancelPromise.current?.();
    upload.current?.abort();
    abort.current?.abort();
  }
  useEffect(() => {
    disposed.current = false;
    void load();
    return disposeTransfers;
    // This component is remounted for every verified actor/dataset/capability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function command(action: string, extra: Record<string, unknown> = {}) {
    if (!media) return null;
    const request = ++fence.current;
    return receive(
      await fetch("/api/coach/media", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, revision: media.revision, ...extra }),
      }),
      request,
    );
  }
  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const next = await command(action, extra);
      if (!next || disposed.current) return;
      if (action === "discard") {
        setFile(null);
        setDescription("");
        setReplaceId(null);
        setPendingId(null);
      }
      if (!disposed.current)
        setMessage(
          action === "publish"
            ? "Training media published."
            : "Media draft updated.",
        );
    } catch (error) {
      if (!disposed.current) setMessage((error as Error).message);
    } finally {
      if (!disposed.current) setBusy(false);
    }
  }
  function choose(selected: File | null, kind: "photo" | "video") {
    if (!selected) return;
    setPendingId(null);
    setReplaceId(null);
    setMessage("");
    if (
      (kind === "photo" &&
        (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
          selected.size > COACH_MEDIA_PHOTO_BYTES)) ||
      (kind === "video" &&
        (!selected.type.startsWith("video/") ||
          selected.size > COACH_MEDIA_VIDEO_PREFLIGHT_BYTES))
    ) {
      setFile(null);
      setMessage(
        kind === "photo"
          ? "Choose a JPEG, PNG or WebP photo up to 4 MiB."
          : "Choose a video up to 250 MiB and 60 seconds.",
      );
      return;
    }
    setFile(selected);
  }
  async function sendFile() {
    if (!file || !media || !validMediaDescription(description.trim())) return;
    const isVideo = file.type.startsWith("video/");
    const id = pendingId ?? crypto.randomUUID();
    setPendingId(id);
    const generation = ++transferGeneration.current;
    const current = () =>
      !disposed.current && generation === transferGeneration.current;
    setBusy(true);
    setMessage("");
    try {
      if (!isVideo) {
        const request = ++fence.current;
        abort.current = new AbortController();
        const result = await receive(
          await fetch("/api/coach/media", {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            signal: abort.current.signal,
            headers: {
              "content-type": file.type,
              "if-match": `"${media.revision}"`,
              "x-media-id": id,
              "x-media-description": encodeURIComponent(description.trim()),
              ...(replaceId ? { "x-replace-id": replaceId } : {}),
            },
            body: file,
          }),
          request,
        );
        if (result?.photos.some((p) => p.id === id) && current()) {
          setFile(null);
          setReplaceId(null);
          setDescription("");
          setPendingId(null);
          setMessage("Photo added to your draft. Publish when you’re ready.");
        } else if (current())
          setMessage(
            "The upload is still being checked. Reload media to finish or cancel it.",
          );
      } else {
        const result = await command("video", {
          id,
          description: description.trim(),
        });
        const item = result?.uploads.find((u) => u.id === id);
        if (!item?.uploadUrl) {
          if (current())
            setMessage(
              "This upload is pending. Reload media to check it or cancel before starting another.",
            );
          return;
        }
        const { createUpload } = await import("@mux/upchunk");
        if (!current()) return;
        setVideoId(id);
        setProgress(0);
        setPaused(false);
        await new Promise<void>((resolve, reject) => {
          const transfer = createUpload({
            endpoint: item.uploadUrl!,
            file,
            chunkSize: 1024,
            attempts: 3,
          });
          upload.current = transfer;
          cancelPromise.current = () =>
            reject(new DOMException("Upload cancelled", "AbortError"));
          transfer.on("progress", (event) => {
            if (current()) setProgress(Math.round(Number(event.detail)));
          });
          transfer.on("success", () => resolve());
          transfer.on("error", () =>
            reject(
              Error(
                "Video upload interrupted. The reservation is retained; retry or cancel it before choosing another video.",
              ),
            ),
          );
        });
        upload.current = null;
        if (current()) {
          setFile(null);
          setPendingId(null);
          await command("refresh-video", { id });
          if (current())
            setMessage(
              "Upload complete. Processing your video; refresh its status when you’re ready.",
            );
        }
      }
    } catch (error) {
      if (current())
        setMessage(
          (error as Error).name === "AbortError"
            ? "Upload stopped. Reload media to check its state before retrying."
            : (error as Error).message,
        );
    } finally {
      if (current()) {
        cancelPromise.current = null;
        setBusy(false);
        setProgress(null);
        setVideoId(null);
      }
    }
  }
  async function cancelTransfer() {
    transferGeneration.current++;
    cancelPromise.current?.();
    cancelPromise.current = null;
    upload.current?.abort();
    upload.current = null;
    abort.current?.abort();
    fence.current++;
    const id = videoId ?? pendingId;
    setBusy(false);
    setProgress(null);
    setVideoId(null);
    if (id) await run("cancel", { id });
    setPendingId(null);
  }
  return (
    <section
      className="coach-media-editor"
      aria-labelledby="coach-media-editor-title"
    >
      <div className="coach-media-heading">
        <div>
          <h3 id="coach-media-editor-title">Photos &amp; video</h3>
          <p>
            Show what training with you feels like. Your portrait and banner
            stay separate.
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Reload media
        </button>
      </div>
      {message && (
        <p role="status" className="coach-media-notice">
          {message}
        </p>
      )}
      {!media ? (
        <p role="status">
          {message
            ? "Training media could not be loaded."
            : "Loading training media…"}
        </p>
      ) : (
        <>
          <div className="coach-media-limits">
            <span>{media.photos.length} / 6 photos</span>
            <span>{media.video ? "1" : "0"} / 1 video · up to 60 seconds</span>
          </div>
          <CoachMediaGallery media={media} slug={null} />
          <ol className="coach-media-order">
            {media.photos.map((photo, index) => (
              <li key={photo.id}>
                <span>
                  {index + 1}. {photo.alt}
                </span>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${photo.alt} earlier`}
                    disabled={busy || active || index === 0}
                    onClick={() => {
                      const ids = media.photos.map((p) => p.id);
                      [ids[index - 1], ids[index]] = [
                        ids[index],
                        ids[index - 1],
                      ];
                      void run("reorder", { ids });
                    }}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${photo.alt} later`}
                    disabled={
                      busy || active || index === media.photos.length - 1
                    }
                    onClick={() => {
                      const ids = media.photos.map((p) => p.id);
                      [ids[index + 1], ids[index]] = [
                        ids[index],
                        ids[index + 1],
                      ];
                      void run("reorder", { ids });
                    }}
                  >
                    <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || active}
                    onClick={() => {
                      setReplaceId(photo.id);
                      setFile(null);
                      setDescription(photo.alt);
                      setPendingId(null);
                      setMessage(
                        `Choose a replacement photo for “${photo.alt}”.`,
                      );
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${photo.alt}`}
                    disabled={busy || active}
                    onClick={() => void run("remove-photo", { id: photo.id })}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {media.video && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || active}
              onClick={() => void run("remove-video")}
            >
              Remove video from draft
            </button>
          )}
          <div className="coach-media-upload-fields">
            <label className="coach-field">
              <span>
                {replaceId ? "Replacement photo" : "Add a training photo"}
              </span>
              <input
                aria-label="Training photo file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={
                  busy || active || (media.photos.length >= 6 && !replaceId)
                }
                onChange={(event) => {
                  const target = replaceId;
                  choose(event.target.files?.[0] ?? null, "photo");
                  setReplaceId(target);
                  event.target.value = "";
                }}
              />
              <small>JPEG, PNG or WebP · Up to 4 MiB</small>
            </label>
            <label className="coach-field">
              <span>
                {media.video
                  ? "Replace your introduction video"
                  : "Add an introduction video"}
              </span>
              <input
                aria-label="Training video file"
                type="file"
                accept="video/*"
                disabled={
                  busy || active || !media.videoAvailable || !media.canPublish
                }
                onChange={(event) => {
                  choose(event.target.files?.[0] ?? null, "video");
                  event.target.value = "";
                }}
              />
              <small>One video up to 60 seconds · 250 MiB file preflight</small>
            </label>
          </div>
          {!media.videoAvailable && (
            <p role="status" className="coach-media-help">
              Video uploads are temporarily unavailable.
            </p>
          )}
          {!media.canPublish && (
            <p role="status" className="coach-media-help">
              You can prepare photos while your application is reviewed. Coach
              approval is required to publish media or upload video.
            </p>
          )}
          {file && (
            <div className="coach-media-file-draft">
              <p>{file.name}</p>
              <label className="coach-field">
                <span id={`${descriptionId}-label`}>
                  {file.type.startsWith("video/")
                    ? "Video description"
                    : "Describe this photo"}
                </span>
                <input
                  aria-labelledby={`${descriptionId}-label`}
                  aria-describedby={`${descriptionId}-help`}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setPendingId(null);
                  }}
                  disabled={busy || !!pendingId}
                  maxLength={160}
                />
                <small id={`${descriptionId}-help`}>
                  Help visitors understand what this media shows. Up to 160
                  characters.
                </small>
              </label>
              <div className="coach-media-actions">
                <button
                  type="button"
                  className="button dark"
                  disabled={busy || !validMediaDescription(description.trim())}
                  onClick={() => void sendFile()}
                >
                  <Upload size={16} /> {busy ? "Uploading…" : "Upload to draft"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    setReplaceId(null);
                    setPendingId(null);
                  }}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}
          {progress !== null && (
            <div className="coach-media-progress">
              <label>
                Video upload: {progress}%<progress max={100} value={progress} />
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (paused) upload.current?.resume();
                  else upload.current?.pause();
                  setPaused(!paused);
                }}
              >
                {paused ? "Resume upload" : "Pause upload"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => void cancelTransfer()}
              >
                Cancel upload
              </button>
            </div>
          )}
          {media.uploads.length > 0 && (
            <ul className="coach-media-pending">
              {media.uploads.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.description} · {item.status}
                    {item.error ? ` — ${item.error}` : ""}
                  </span>
                  <div>
                    {item.kind === "photo" && (
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void run("finish-photo", { id: item.id })
                        }
                      >
                        Finish photo upload
                      </button>
                    )}
                    {item.kind === "video" && item.status !== "failed" && (
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void run("refresh-video", { id: item.id })
                        }
                      >
                        Refresh video status
                      </button>
                    )}
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => {
                        setPendingId(null);
                        void run("cancel", { id: item.id });
                      }}
                    >
                      Cancel pending upload
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="coach-media-publish">
            <p>
              {dirty
                ? "Unpublished media changes"
                : "Your media draft matches the published version."}
            </p>
            <div className="coach-media-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy || (!dirty && !active)}
                onClick={() => void run("discard")}
              >
                Discard media changes
              </button>
              <button
                type="button"
                className="button dark"
                disabled={busy || active || !dirty || !media.canPublish}
                onClick={() => void run("publish")}
              >
                Publish media
              </button>
            </div>
          </div>
          {media.cleanupPending && (
            <p role="status" className="coach-media-help">
              Old media cleanup is pending and will be retried with your next
              media change.
            </p>
          )}
        </>
      )}
    </section>
  );
}
