"use client";
import { ExternalLink, Film, Plus, Trash2 } from "lucide-react";
import type { VideoReference } from "@/notes/contracts";
import "./notes.css";

export function VideoLinks({ videos }: { videos: readonly VideoReference[] }) {
  if (!videos.length) return null;
  return (
    <ul className="note-videos" aria-label="Video references">
      {videos.map((v, i) => (
        <li key={`${v.url}:${i}`}>
          <a
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <span className="note-video-icon">
              <Film size={19} aria-hidden="true" />
            </span>
            <span>
              <strong>{v.label}</strong>
              <small>
                {v.url.includes("instagram.com/") ? "Instagram" : "YouTube"} ·
                Opens in a new tab
              </small>
            </span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
export function VideoLinkEditor({
  videos,
  onChange,
  disabled = false,
  id,
}: {
  videos: readonly VideoReference[];
  onChange: (videos: readonly VideoReference[]) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div className="note-link-editor">
      {videos.map((v, i) => (
        <fieldset key={i} disabled={disabled} className="note-link-row">
          <legend>Video {i + 1}</legend>
          <label htmlFor={`${id}-label-${i}`}>
            Video title
            <input
              id={`${id}-label-${i}`}
              value={v.label}
              maxLength={80}
              required
              placeholder="e.g. Footwork drill"
              onChange={(e) =>
                onChange(
                  videos.map((old, n) =>
                    n === i ? { ...old, label: e.target.value } : old,
                  ),
                )
              }
            />
          </label>
          <label htmlFor={`${id}-url-${i}`}>
            YouTube or Instagram URL
            <input
              id={`${id}-url-${i}`}
              type="url"
              value={v.url}
              maxLength={2048}
              required
              placeholder="https://…"
              onChange={(e) =>
                onChange(
                  videos.map((old, n) =>
                    n === i ? { ...old, url: e.target.value } : old,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="note-remove"
            aria-label={`Remove video ${i + 1}`}
            onClick={() => onChange(videos.filter((_, n) => n !== i))}
          >
            <Trash2 size={16} aria-hidden="true" /> Remove
          </button>
        </fieldset>
      ))}
      {videos.length < 5 && (
        <button
          type="button"
          className="note-add-video"
          disabled={disabled}
          onClick={() => onChange([...videos, { label: "", url: "" }])}
        >
          <Plus size={15} aria-hidden="true" /> Add video link
        </button>
      )}
      <p className="note-help">
        Save a drill, technique or video to come back to. Links open on YouTube
        or Instagram.
      </p>
    </div>
  );
}
