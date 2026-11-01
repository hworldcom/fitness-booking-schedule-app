"use client";
import { useState } from "react";
import Link from "next/link";
import { BookingEditor } from "@/features/session-types/booking-editor";
import { CalendarDays, Check, LockKeyhole, NotebookPen } from "lucide-react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import { SessionNotes } from "@/features/notes/session-notes";
import { VideoLinks } from "@/features/notes/video-links";
import { WorkoutEditor } from "@/features/training/workout-editor";
import type { TrainingCommand } from "@/training/contracts";
import { previewBookingId, previewWorkout } from "./session-notes-data";
import "@/features/training/training.css";
import "./session-notes-preview.css";
export function BookingNavigationPreview({
  coachView,
}: {
  coachView: boolean;
}) {
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "15000000-0000-4000-8000-000000000008",
        email: "preview@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider
        initialActor={{
          status: "authorized",
          profile: {
            slug: "coach",
            displayName: "Alex",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "notes-preview", name: "Fictional notes preview" },
          role: "member",
          coachAccessStatus: "approved",
        }}
      >
        <BookingEditor bookingId={previewBookingId} coachView={coachView} />
      </ActorProvider>
    </AuthSessionProvider>
  );
}
export default function NotesPreview({
  initialMode = "coach",
}: {
  initialMode?: "personal" | "coach" | "athlete";
}) {
  const [mode, setMode] = useState<"personal" | "coach" | "athlete">(
    initialMode,
  );
  const role = mode === "athlete" ? "athlete" : "coach";
  const [workout, setWorkout] = useState(previewWorkout),
    [editor, setEditor] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(command: TrainingCommand) {
    setBusy(true);
    try {
      const r = await fetch("/api/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command, scope: "notes-preview:coach" }),
      });
      if (!r.ok) throw Error("Save unavailable");
      const read = await fetch("/api/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          command: { action: "list", args: {} },
          scope: "notes-preview:coach",
        }),
      });
      const next = await read.json();
      setWorkout(next.value.items[0]);
      setEditor(false);
    } catch {
      setError("Preview save unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthSessionProvider
      initialSession={{
        status: "signed-in",
        subject: "15000000-0000-4000-8000-000000000008",
        email: "preview@example.invalid",
        expiresAt: null,
      }}
    >
      <ActorProvider
        key={role}
        initialActor={{
          status: "authorized",
          profile: {
            slug: role,
            displayName: role === "coach" ? "Alex" : "Sam",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "notes-preview", name: "Fictional notes preview" },
          role: "member",
          coachAccessStatus: role === "coach" ? "approved" : "not-applied",
        }}
      >
        <div className="notes-preview-banner">
          Interactive local preview · Fictional sessions · Changes stay in this
          preview
        </div>
        <main className="notes-preview">
          <header className="notes-preview-top">
            <Link href="/notes-preview" className="notes-preview-brand">
              MovX<span>CLUB</span>
            </Link>
            <span>YOUR TRAINING, REMEMBERED</span>
          </header>
          <nav className="notes-preview-switch" aria-label="Preview view">
            {(
              [
                ["personal", "Personal workout"],
                ["coach", "Coach session"],
                ["athlete", "Athlete session"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  document.cookie = `notes_preview_role=${key === "athlete" ? "athlete" : "coach"}; path=/; SameSite=Lax`;
                  document.cookie = `notes_preview_mode=${key}; path=/; SameSite=Lax`;
                  setMode(key);
                  setEditor(false);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="notes-preview-context">
            <div>
              <span className="eyebrow">
                {mode === "personal" ? "MY WORKOUT" : "PRIVATE TRAINING"}
              </span>
              <h1>
                {mode === "personal" ? workout.title : "Footwork & distance"}
              </h1>
              <p>
                <CalendarDays size={15} aria-hidden="true" />
                {mode === "personal"
                  ? "Saturday, 31 October · 45 minutes"
                  : "Monday, 2 November · 11:00–12:00 · Studio North, Berlin"}
              </p>
            </div>
            <span className="note-visibility">
              {mode === "personal" ? (
                <Check size={14} />
              ) : (
                <NotebookPen size={14} />
              )}{" "}
              {mode === "personal" ? "Workout logged" : "Confirmed session"}
            </span>
          </section>
          {mode === "personal" ? (
            <section className="session-notes">
              <header className="notes-heading">
                <div>
                  <span className="eyebrow">FOR YOUR NEXT WORKOUT</span>
                  <h2>Notes & videos</h2>
                  <p>A few details worth keeping.</p>
                </div>
                <span className="note-visibility">
                  <LockKeyhole size={13} />
                  Only you
                </span>
              </header>
              <article className="note-panel">
                <div className="note-panel-head">
                  <h3>What I want to remember</h3>
                  <button
                    onClick={() => {
                      setEditor(true);
                      setError("");
                    }}
                  >
                    Edit workout
                  </button>
                </div>
                <p className="note-body">
                  {workout.notes ||
                    "Add a thought or a useful cue for this workout."}
                </p>
                <VideoLinks videos={workout.videos ?? []} />
              </article>
            </section>
          ) : (
            <SessionNotes key={role} bookingId={previewBookingId} />
          )}
          {editor && (
            <WorkoutEditor
              item={workout}
              timezone="UTC"
              busy={busy}
              referenceTime="2026-10-31T16:00:00Z"
              selectedDay="2026-10-31"
              error={error}
              onClose={() => setEditor(false)}
              onSave={(command) => void save(command)}
            />
          )}
        </main>
      </ActorProvider>
    </AuthSessionProvider>
  );
}
