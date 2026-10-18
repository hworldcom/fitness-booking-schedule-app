"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SessionActorBoundary } from "./actor-boundary";

import {
  SESSION_DURATIONS,
  type SessionType,
  type SessionTypeCommand,
  type SessionTypeResult,
} from "@/domain/session-types";
import "./session-types.css";
const errors = {
  invalid: "Review the name, duration and venue, then try again.",
  conflict: "This type changed. Reload the catalog before editing again.",
  forbidden: "Your coach access has changed. Reload to check your access.",
  "signed-out": "Sign in to manage your session types.",
  unavailable:
    "We couldn’t verify the save. Retry the same action or reload to check.",
  "not-found": "This session type is no longer available.",
};
function emptyType(): SessionType {
  return {
    id: crypto.randomUUID(),
    format: "private",
    name: "",
    description: "",
    color: "#2563eb",
    durationMinutes: 60,
    defaultLocationId: null,
    bookable: true,
    archived: false,
    revision: -1,
  };
}
export function SessionTypeManager() {
  return (
    <section className="session-types-page">
      <header>
        <Link href="/coach">← Schedule</Link>
        <h1>Session types</h1>
        <p>Create classes athletes can choose when requesting a session.</p>
      </header>
      <SessionActorBoundary>
        {(identity) => <Catalog key={identity} />}
      </SessionActorBoundary>
    </section>
  );
}
function Catalog() {
  const [state, setState] = useState<SessionTypeResult | null>(null);
  const [draft, setDraft] = useState<SessionType | null>(null);
  const [review, setReview] = useState<SessionType | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<SessionTypeCommand | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const load = async () => {
    const version = ++loadVersion.current;
    setBusy(true);
    try {
      const response = await fetch("/api/coach/session-types", {
        cache: "no-store",
      });
      const result = (await response.json()) as SessionTypeResult;
      if (mounted.current && version === loadVersion.current) {
        setState(result);
        setDraft(null);
        setReview(null);
        setPending(null);
        setMessage(
          result.status === "ready"
            ? ""
            : (errors[result.status as keyof typeof errors] ?? ""),
        );
      }
    } catch {
      if (mounted.current && version === loadVersion.current)
        setMessage(errors.unavailable);
    } finally {
      if (mounted.current && version === loadVersion.current) setBusy(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(load);
    return () => {
      mounted.current = false;
    };
  }, []);
  async function mutate(command: SessionTypeCommand) {
    setBusy(true);
    setMessage("");
    setPending(command);
    try {
      const r = await fetch("/api/coach/session-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = (await r.json()) as SessionTypeResult;
      if (!mounted.current) return;
      if (result.status === "saved") {
        setState(result);
        setDraft(null);
        setReview(null);
        setPending(null);
        setMessage("Saved.");
      } else {
        setMessage(
          errors[result.status as keyof typeof errors] ?? errors.unavailable,
        );
        if (result.status !== "unavailable") setPending(null);
      }
    } catch {
      if (mounted.current) setMessage(errors.unavailable);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const types = state && "types" in state ? state.types : [];
  return (
    <>
      <div className="session-type-toolbar">
        <button
          className="button dark"
          disabled={busy || !state || !("types" in state)}
          onClick={() => {
            if (!draft || confirm("Discard your unsaved changes?")) {
              setDraft(emptyType());
              setReview(null);
            }
          }}
        >
          Create session type
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (!draft || confirm("Discard your unsaved changes and reload?"))
              void load();
          }}
        >
          Reload catalog
        </button>
        {state && "types" in state && types.length === 0 && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void mutate({
                commandId: crypto.randomUUID(),
                action: "defaults",
              })
            }
          >
            Add Private and Group defaults
          </button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {busy
          ? "Working…"
          : message || (!state ? "Loading your session types…" : "")}
      </p>
      {pending && !busy && (
        <button
          className="button secondary"
          onClick={() => void mutate(pending!)}
        >
          Retry the same save
        </button>
      )}
      {draft && (
        <form
          className="session-type-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({
              commandId: crypto.randomUUID(),
              action: "save",
              id: draft.id,
              expectedRevision: draft.revision,
              format: draft.format,
              name: draft.name,
              description: draft.description,
              color: draft.color,
              durationMinutes: draft.durationMinutes,
              defaultLocationId: draft.defaultLocationId,
              bookable: draft.bookable,
            });
          }}
        >
          <h2>
            {draft.revision < 0 ? "New session type" : `Edit ${draft.name}`}
          </h2>
          <label>
            Name
            <input
              required
              maxLength={80}
              value={draft.name}
              disabled={busy}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="session-type-fields">
            <label>
              Format
              <select
                disabled={busy || draft.revision >= 0}
                aria-label="Format"
                value={draft.format}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    format: e.target.value as SessionType["format"],
                  })
                }
              >
                <option value="private">Private</option>
                <option value="group">Group</option>
              </select>
            </label>
            <label>
              Duration
              <select
                disabled={busy}
                aria-label="Duration"
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: Number(
                      e.target.value,
                    ) as SessionType["durationMinutes"],
                  })
                }
              >
                {SESSION_DURATIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Calendar color
              <input
                type="color"
                disabled={busy}
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              rows={3}
              maxLength={1000}
              disabled={busy}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            Default venue
            <select
              disabled={busy}
              aria-label="Default venue"
              value={draft.defaultLocationId ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultLocationId: e.target.value || null,
                })
              }
            >
              <option value="">Choose when scheduling</option>
              {state &&
                "types" in state &&
                state.locations?.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="session-type-check">
            <input
              type="checkbox"
              disabled={busy}
              checked={draft.bookable}
              onChange={(e) =>
                setDraft({ ...draft, bookable: e.target.checked })
              }
            />
            {draft.format === "group"
              ? "Allow new group registrations"
              : "Allow athletes to request this class"}
          </label>
          <p>
            Changes close pending requests for the previous version. Confirmed
            sessions keep their reviewed details.
          </p>
          <div className="session-type-toolbar">
            <button disabled={busy} className="button dark">
              Save type
            </button>
            <button
              disabled={busy}
              type="button"
              className="button secondary"
              onClick={() => setDraft(null)}
            >
              Discard changes
            </button>
          </div>
        </form>
      )}
      {review && (
        <section
          className="session-type-editor"
          aria-label="Remove session type"
        >
          <h2>Remove {review.name}?</h2>
          <p>
            Athletes won’t be able to book this type. Already scheduled sessions
            and their history stay available. You can restore the type later.
          </p>
          <div className="session-type-toolbar">
            <button
              className="button dark"
              disabled={busy}
              onClick={() =>
                void mutate({
                  commandId: crypto.randomUUID(),
                  action: "archive",
                  id: review.id,
                  expectedRevision: review.revision,
                })
              }
            >
              Remove type
            </button>
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => setReview(null)}
            >
              Keep type
            </button>
          </div>
        </section>
      )}
      {state && "types" in state && types.length === 0 && (
        <p>No session types yet. Create your own or add the two defaults.</p>
      )}
      <div className="session-type-list">
        {types.map((t) => (
          <article key={t.id} className="session-type-card">
            <span
              aria-hidden="true"
              className="session-type-color"
              style={{ background: t.color }}
            />
            <div>
              <h2>{t.name}</h2>
              <p>
                {t.format === "private" ? "Private" : "Group"} ·{" "}
                {t.durationMinutes} min ·{" "}
                {t.archived
                  ? "Removed"
                  : t.bookable
                    ? "Available for requests"
                    : "Not offered publicly"}
              </p>
              {t.description && <p>{t.description}</p>}
            </div>
            <div className="session-type-toolbar">
              {t.archived ? (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate({
                      commandId: crypto.randomUUID(),
                      action: "restore",
                      id: t.id,
                      expectedRevision: t.revision,
                    })
                  }
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!draft || confirm("Discard unsaved changes?")) {
                        setDraft({ ...t });
                        setReview(null);
                      }
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setReview(t);
                      setDraft(null);
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
