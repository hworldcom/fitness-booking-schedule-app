"use client";
/* eslint-disable @next/next/no-img-element -- private versioned normalized banner, never the public optimizer */
import { useEffect, useRef, useState } from "react";
import type { EventBannerResult } from "@/domain/event-banners";
import { requestEventBanner } from "./banner-client";

export function EventBannerEditor({
  eventId,
  initial,
}: {
  eventId: string;
  initial: EventBannerResult;
}) {
  const [saved, setSaved] = useState(
    initial.status === "ready" || initial.status === "saved"
      ? initial.eventBanner
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(
    initial.status !== "ready" && initial.status !== "saved",
  );
  const [message, setMessage] = useState(
    needsReload
      ? "The banner could not be verified. Load the latest before editing."
      : "",
  );
  const [selected, setSelected] = useState<File | null>(null);
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const working = useRef(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const serverReadOnly =
    (initial.status === "ready" || initial.status === "saved") &&
    !initial.eventBanner.editable;
  const editable = saved?.editable && !serverReadOnly;

  async function change(method: "GET" | "POST" | "DELETE", file?: File) {
    if (
      working.current ||
      (method !== "GET" && (!editable || needsReload)) ||
      (method === "POST" && !file)
    )
      return;
    working.current = true;
    setBusy(true);
    const ticket = ++generation.current;
    setMessage(
      method === "GET"
        ? "Loading the latest banner…"
        : method === "DELETE"
          ? "Removing the banner…"
          : "Uploading and checking your image…",
    );
    const result = await requestEventBanner(
      eventId,
      method === "GET"
        ? { method }
        : method === "DELETE"
          ? { method, revision: saved!.revision }
          : { method, revision: saved!.revision, file: file! },
    );
    if (generation.current !== ticket) return;
    working.current = false;
    setBusy(false);
    if (result.status === "ready" || result.status === "saved") {
      setSaved(result.eventBanner);
      setNeedsReload(false);
      setFailedPreview(null);
      if (method !== "GET") setSelected(null);
      setMessage(
        method === "GET"
          ? "Latest saved banner loaded. Review it before retrying a selected image."
          : method === "DELETE"
            ? "Event banner removed. Public cards use your coach banner when available."
            : result.cleanupPending
              ? "Banner saved. Earlier image cleanup will need another attempt."
              : "Event banner saved.",
      );
      return;
    }
    const lostAccess = ["signed-out", "forbidden", "not-found"].includes(
      result.status,
    );
    if (lostAccess) setSaved(null);
    const reload = result.status !== "invalid";
    setNeedsReload(reload);
    setMessage(
      result.status === "invalid"
        ? "Choose a single-frame JPEG, PNG or WebP up to 4 MiB and at least 320 × 120 px."
        : result.status === "conflict"
          ? "This banner or session changed. Load the latest, review it and then retry."
          : lostAccess
            ? "Your access to this session changed. Reload Events to verify your account."
            : "The saved outcome could not be verified. Load the latest before retrying; a save may have completed.",
    );
  }
  const preview = saved?.banner?.card;
  return (
    <section
      className="coach-event-panel event-banner-editor"
      aria-labelledby={`event-banner-${eventId}`}
    >
      <h2 id={`event-banner-${eventId}`}>Event banner</h2>
      <p>
        Optional image for this group session. When absent, public cards use
        your coach banner, then a decorative cover. Your public coach portrait
        stays separate.
      </p>
      <p>
        JPEG, PNG or WebP · Up to 4 MiB · Single frame · At least 320 × 120 px ·
        Center-cropped to 8:3.
      </p>
      {preview && failedPreview !== preview.url && (
        <img
          className="event-banner-editor-preview"
          src={preview.url}
          width={preview.width}
          height={preview.height}
          alt="Saved banner for this group session"
          onError={() => {
            setFailedPreview(preview.url);
          }}
        />
      )}
      {preview && failedPreview === preview.url && (
        <p>
          Preview unavailable. Load the latest saved banner before retrying.
        </p>
      )}
      {saved && !saved.editable && (
        <p>
          This session’s banner is read-only because it is closed or its editing
          window has ended.
        </p>
      )}
      {editable && (
        <>
          <label className="event-banner-file">
            <span>
              {saved?.banner
                ? "Replace event banner (saves immediately)"
                : "Upload event banner (saves immediately)"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || needsReload}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  setSelected(file);
                  void change("POST", file);
                }
              }}
            />
          </label>
          {selected && (
            <p>
              Selected: {selected.name}.{" "}
              {needsReload
                ? "Load the latest before retrying this image."
                : "You can retry this selected image."}
            </p>
          )}
          <div className="coach-event-actions">
            {selected && (
              <button
                className="button secondary"
                type="button"
                disabled={busy || needsReload}
                onClick={() => void change("POST", selected)}
              >
                Retry selected image
              </button>
            )}
            {saved?.banner && (
              <button
                className="button secondary"
                type="button"
                disabled={busy || needsReload}
                onClick={() => void change("DELETE")}
              >
                Remove event banner
              </button>
            )}
          </div>
          <p>
            Banner changes save immediately and independently. They do not
            change the session’s time, venue, price or capacity.
          </p>
        </>
      )}
      <button
        className="button secondary"
        type="button"
        disabled={busy}
        onClick={() => void change("GET")}
      >
        Load latest banner
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
