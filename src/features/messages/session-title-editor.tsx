"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  sessionTitle,
  validSessionTitle,
  type SessionTitleDetails,
} from "@/domain/session-titles";
import { accessRevoked, MailboxError, messageWrite } from "@/messages/client";

export function SessionTitleEditor({
  bookingId,
  value,
  onSaved,
}: {
  bookingId: string;
  value: SessionTitleDetails;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SessionTitleDetails | null>(null);
  const current =
    saved && saved.titleRevision > value.titleRevision ? saved : value;
  async function save() {
    if (busy || !validSessionTitle(draft)) return;
    setBusy(true);
    setError("");
    try {
      const next = (await messageWrite("session-title", {
        bookingId,
        title: draft.trim(),
        expectedRevision: revision,
      })) as SessionTitleDetails;
      setSaved(next);
      setEditing(false);
      onSaved?.();
      router.refresh();
    } catch (e) {
      if (accessRevoked(e)) {
        setDraft("");
        setEditing(false);
      }
      setError(
        e instanceof MailboxError && e.status === "conflict"
          ? "This session changed. Your title is kept below. Cancel and reopen to use the latest version."
          : "The title could not be saved. Your changes are kept; try again.",
      );
      onSaved?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="session-title-editor">
      <strong>{sessionTitle(current.title)}</strong>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor={inputId}>Session title</label>
          <input
            id={inputId}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            aria-describedby={`${inputId}-help`}
          />
          <small id={`${inputId}-help`}>
            Optional · up to 100 characters · shared with both participants
          </small>
          {!validSessionTitle(draft) && (
            <p role="alert">Use a single line of up to 100 characters.</p>
          )}
          <div>
            <button
              type="submit"
              disabled={
                busy || !current.canEditTitle || !validSessionTitle(draft)
              }
            >
              {busy ? "Saving…" : "Save title"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        current.canEditTitle && (
          <button
            type="button"
            onClick={() => {
              setDraft(current.title);
              setRevision(current.titleRevision);
              setError("");
              setEditing(true);
            }}
          >
            {current.title ? "Edit title" : "Add title"}
          </button>
        )
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
