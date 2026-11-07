"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, LockKeyhole, NotebookPen, Users } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import {
  parseNotesCommand,
  noteCharacterCount,
  noteTextError,
  type NoteEntry,
  type NoteKind,
  type NotesCommand,
  type NotesResult,
  type SessionNotesPage,
  type VideoReference,
} from "@/notes/contracts";
import { VideoLinkEditor, VideoLinks } from "./video-links";
import { videoReferenceErrors } from "@/domain/video-references";
import "./notes.css";

type Draft = { kind: NoteKind | "plan"; entry?: NoteEntry };
const noteDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function SessionNotes({ bookingId }: { bookingId: string }) {
  const { actor } = useActor();
  if (actor.status !== "authorized")
    return <p role="status">Sign in to load your session notes.</p>;
  const scope = `${actor.demoRun.slug}:${actor.profile.slug}`;
  return (
    <NotesWorkspace
      key={`${scope}:${bookingId}`}
      bookingId={bookingId}
      scope={scope}
    />
  );
}
function NotesWorkspace({
  bookingId,
  scope,
}: {
  bookingId: string;
  scope: string;
}) {
  const { actor } = useActor();
  const currentScope =
    actor.status === "authorized"
      ? `${actor.demoRun.slug}:${actor.profile.slug}`
      : "";
  const live = useRef(currentScope);
  useEffect(() => {
    live.current = currentScope;
  }, [currentScope]);
  const [pages, setPages] = useState<
    Partial<Record<NoteKind, SessionNotesPage>>
  >({});
  const [kind, setKind] = useState<NoteKind>("shared");
  const [editor, setEditor] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(true);
  const running = useRef(false);
  const [pending, setPending] = useState<NotesCommand | null>(null);
  const [conflict, setConflict] = useState<{
    current: NoteEntry | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [denied, setDenied] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editor) {
      wasEditing.current = true;
      return;
    }
    if (!wasEditing.current || busy) return;
    (pending ? retryButton.current : opener.current)?.focus();
    wasEditing.current = false;
  }, [editor, busy, pending]);
  const page = pages[kind];
  const shared = pages.shared;
  const paused = busy || !!pending || needsRefresh;
  async function request(command: NotesCommand): Promise<NotesResult> {
    const r = await fetch("/api/session-notes", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, scope }),
    });
    const result: NotesResult = await r.json();
    if (live.current !== scope || ("scope" in result && result.scope !== scope))
      throw Error("Account changed. Reload this session.");
    return result;
  }
  function conceal() {
    setDenied(true);
    setPages({});
    setEditor(null);
    setPending(null);
  }
  async function load(target: NoteKind, earlier = false) {
    const result = await request({
      action: "read",
      args: {
        bookingId,
        kind: target,
        ...(earlier && pages[target]?.next
          ? { before: pages[target]!.next! }
          : {}),
      },
    });
    if (result.status === "ready") {
      setPages((old) => ({
        ...old,
        [target]: {
          ...result.value,
          entries: earlier
            ? [
                ...result.value.entries,
                ...(old[target]?.entries ?? []).filter(
                  (e) => !result.value.entries.some((n) => n.id === e.id),
                ),
              ]
            : result.value.entries,
        },
      }));
      setNeedsRefresh(false);
      return true;
    }
    if (["forbidden", "signed-out", "actor-changed"].includes(result.status)) {
      conceal();
      return false;
    }
    throw Error(
      "Session notes could not be loaded. Your saved notes have not been cleared.",
    );
  }
  useEffect(() => {
    let active = true;
    running.current = true;
    // An effect owns only its initial read. Unmounting makes its result private
    // to the old workspace and cannot retarget a new actor/booking draft.
    void request({ action: "read", args: { bookingId, kind: "shared" } })
      .then((r) => {
        if (!active) return;
        if (r.status === "ready") setPages({ shared: r.value });
        else if (
          ["forbidden", "signed-out", "actor-changed"].includes(r.status)
        )
          conceal();
        else setError("Session notes could not be loaded. Try again.");
      })
      .catch(() => {
        if (active) setError("Session notes could not be loaded. Try again.");
      })
      .finally(() => {
        if (active) {
          running.current = false;
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
    // The keyed workspace pins actor/booking for this lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function refresh(target = kind, earlier = false) {
    if (running.current || pending) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await load(target, earlier);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function save(command: NotesCommand) {
    if (
      running.current ||
      needsRefresh ||
      (pending && JSON.stringify(command) !== JSON.stringify(pending))
    )
      return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setConflict(null);
    setPending(command);
    try {
      const r = await request(command);
      if (r.status === "saved") {
        setPending(null);
        setEditor(null);
        setMessage("Your note is saved.");
        setNeedsRefresh(true);
        try {
          await load(command.args.kind === "private" ? "private" : "shared");
        } catch {
          try {
            await load(command.args.kind === "private" ? "private" : "shared");
          } catch {
            setError(
              "Your note was saved, but the session could not refresh. Reload saved notes before another change.",
            );
          }
        }
      } else if (r.status === "conflict") {
        setPending(null);
        setConflict({ current: r.current });
        setError(
          "This note changed. Your draft is still here. Review the saved version before editing again.",
        );
      } else if (r.status === "unavailable")
        setError(
          "The save could not be verified. Retry the same save to check its outcome.",
        );
      else {
        setPending(null);
        setError(
          r.status === "limit"
            ? "This section has reached its 100-note limit. You can still edit your existing notes."
            : r.status === "invalid"
              ? "This session could not accept the save. Your draft is still here. Copy it before reloading this session."
              : "This session no longer allows this change. Your draft is still here while access is checked.",
        );
        if (["forbidden", "signed-out", "actor-changed"].includes(r.status))
          await load(kind);
      }
    } catch {
      setError(
        "The save could not be verified. Retry the same save to check its outcome.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function begin(draft: Draft) {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditor(draft);
    setConflict(null);
    setError("");
    setMessage("");
  }
  if (currentScope !== scope || denied)
    return (
      <section className="session-notes" role="alert">
        <p>Your session notes are unavailable for this account.</p>
        <Link href="/sessions">Back to My training</Link>
      </section>
    );
  return (
    <section
      className="session-notes"
      aria-label="Session notes and videos"
      id="notes"
    >
      <header className="notes-heading">
        <div>
          <span className="eyebrow">THE SESSION RECORD</span>
          <h2>Notes & videos</h2>
          <p>A place for the plan, the practice, and what comes next.</p>
        </div>
        <span className="note-visibility">
          {kind === "private" ? <LockKeyhole size={13} /> : <Users size={14} />}
          {kind === "private" ? "Only you" : "Shared with your session partner"}
        </span>
      </header>
      {shared?.viewerIsCoach && (
        <nav className="notes-tabs" aria-label="Note visibility">
          <button
            disabled={paused || !!editor}
            aria-pressed={kind === "shared"}
            onClick={() => {
              setKind("shared");
              setEditor(null);
              setConflict(null);
            }}
          >
            Shared session
          </button>
          <button
            disabled={paused || !!editor}
            aria-pressed={kind === "private"}
            onClick={() => {
              setKind("private");
              setEditor(null);
              setConflict(null);
              if (!pages.private) void refresh("private");
            }}
          >
            My private notes
          </button>
        </nav>
      )}
      {error && (
        <div role="alert" className="note-error">
          <p>{error}</p>
          {pending ? (
            <button
              ref={retryButton}
              className="note-reload"
              disabled={busy}
              onClick={() => void save(pending)}
            >
              Retry same save
            </button>
          ) : (
            <button
              className="note-reload"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Reload saved notes
            </button>
          )}
        </div>
      )}
      <p role="status" className="notes-status">
        {busy ? "Loading or saving notes…" : message}
      </p>
      {!page && !error && <p role="status">Loading session notes…</p>}
      {page && (
        <>
          {!page.canWrite && (
            <p className="note-help">
              These notes are read-only. The session status or contact
              permissions currently prevent new changes.
            </p>
          )}
          {kind === "private" && (
            <p className="note-help">
              For your own preparation and reflections. Your athlete cannot see
              this section or its contents.
            </p>
          )}
          <div className={kind === "shared" ? "notes-grid" : "notes-feed"}>
            {kind === "shared" && (
              <aside
                className="note-panel note-plan"
                aria-label="Shared training plan"
              >
                <div className="note-panel-head">
                  <BookOpen size={20} aria-hidden="true" />
                  {page.viewerIsCoach && (
                    <button
                      disabled={paused || !page.canWrite}
                      onClick={() =>
                        begin({ kind: "plan", entry: page.plan ?? undefined })
                      }
                    >
                      {page.plan?.body ? "Edit plan" : "Add a plan"}
                    </button>
                  )}
                </div>
                <h3>The session plan</h3>
                <p className="note-help">
                  Set by the coach · Visible to both of you
                </p>
                {page.plan?.body ? (
                  <>
                    <p className="note-body">{page.plan.body}</p>
                    <VideoLinks videos={page.plan.videos} />
                    <p className="note-help">
                      Updated {noteDate(page.plan.updatedAt)}
                    </p>
                  </>
                ) : (
                  <p className="note-empty">
                    A little direction for the session.
                    <br />
                    Your coach can add the focus and useful videos here.
                  </p>
                )}
                {page.conversationHref && (
                  <Link className="text-link" href={page.conversationHref}>
                    Discuss in Messages →
                  </Link>
                )}
              </aside>
            )}
            <div className="notes-feed">
              <div className="note-panel-head">
                <h3>
                  {kind === "private" ? "My private notes" : "Session notes"}
                </h3>
                <button
                  disabled={paused || !page.canWrite || page.total >= 100}
                  onClick={() => begin({ kind })}
                >
                  Add a note
                </button>
              </div>
              {page.next && (
                <button
                  className="note-reload"
                  disabled={paused}
                  onClick={() => void refresh(kind, true)}
                >
                  Load earlier notes
                </button>
              )}
              {page.entries.map((entry) => (
                <article className="note-card" key={entry.id}>
                  <div className="note-author">
                    <div>
                      <strong>
                        {entry.authorName}
                        {entry.authorId === page.viewerId ? " · You" : ""}
                      </strong>
                      <small>
                        {noteDate(entry.createdAt)}
                        {entry.revision > 1 ? " · Edited" : ""}
                      </small>
                    </div>
                    {entry.authorId === page.viewerId && (
                      <button
                        disabled={paused || !page.canWrite}
                        onClick={() => begin({ kind, entry })}
                      >
                        Edit note
                      </button>
                    )}
                  </div>
                  <p className="note-body">{entry.body}</p>
                  <VideoLinks videos={entry.videos} />
                </article>
              ))}
              {!page.entries.length && (
                <div className="note-panel note-empty">
                  <NotebookPen size={25} aria-hidden="true" />
                  <strong>
                    {kind === "private"
                      ? "Space for your own thoughts"
                      : "Keep the useful things"}
                  </strong>
                  <p>
                    {kind === "private"
                      ? "Prepare, reflect and keep video references just for you."
                      : "What worked? What needs another try? Add a note and any videos worth returning to."}
                  </p>
                </div>
              )}
              {editor && (
                <NoteForm
                  key={`${editor.kind}:${editor.entry?.id ?? "new"}`}
                  draft={editor}
                  bookingId={bookingId}
                  disabled={busy || !!pending || !page.canWrite || needsRefresh}
                  conflict={conflict}
                  onUseSaved={(entry) => {
                    setEditor({ kind: editor.kind, entry: entry ?? undefined });
                    setConflict(null);
                    setError("");
                  }}
                  onSave={(command) => void save(command)}
                  onCancel={() => {
                    setEditor(null);
                    setConflict(null);
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function NoteForm({
  draft,
  bookingId,
  disabled,
  conflict,
  onUseSaved,
  onSave,
  onCancel,
}: {
  draft: Draft;
  bookingId: string;
  disabled: boolean;
  conflict: { current: NoteEntry | null } | null;
  onUseSaved: (entry: NoteEntry | null) => void;
  onSave: (c: NotesCommand) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(draft.entry?.body ?? "");
  const [videos, setVideos] = useState<readonly VideoReference[]>(
    draft.entry?.videos ?? [],
  );
  const [revision, setRevision] = useState(draft.entry?.revision ?? 0);
  const [submitted, setSubmitted] = useState(false);
  const [focusAttempt, setFocusAttempt] = useState(0);
  const [preparationError, setPreparationError] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  useEffect(() => {
    if (focusAttempt)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [focusAttempt]);
  const plan = draft.kind === "plan";
  const bodyId = `session-note-body-${draft.kind}`;
  const videoId = `session-${draft.kind}`;
  const bodyError =
    noteTextError(body, plan) ??
    (plan && !body.trim() && videos.length
      ? "Add training plan text, or remove all video links to clear the plan."
      : null);
  const videoErrors = videos.map(videoReferenceErrors);
  const invalidFields = [
    ...(bodyError
      ? [
          {
            id: bodyId,
            label: plan ? "Training plan" : "Your note",
            message: bodyError,
          },
        ]
      : []),
    ...videoErrors.flatMap((errors, index) =>
      (["label", "url"] as const).flatMap((key) =>
        errors[key]
          ? [
              {
                id: `${videoId}-${key}-${index}`,
                label: `Video ${index + 1} ${key === "label" ? "title" : "URL"}`,
                message: errors[key],
              },
            ]
          : [],
      ),
    ),
  ];
  const characters = noteCharacterCount(body);
  const limit = plan ? 8000 : 2000;
  return (
    <form
      ref={form}
      noValidate
      className="note-compose"
      aria-label={
        plan
          ? "Edit training plan"
          : draft.kind === "private"
            ? "Edit private note"
            : "Edit shared note"
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || conflict) return;
        setSubmitted(true);
        setPreparationError("");
        if (invalidFields.length) {
          setFocusAttempt((attempt) => attempt + 1);
          return;
        }
        const command = parseNotesCommand({
          action: "save",
          args: {
            bookingId,
            kind: draft.kind,
            operationId: crypto.randomUUID(),
            revision,
            ...(draft.entry && !plan ? { entryId: draft.entry.id } : {}),
            body,
            videos,
          },
        });
        if (!command) {
          setPreparationError(
            "This note could not be submitted. Your draft is still here. Copy it before reloading this session.",
          );
          return;
        }
        onSave(command);
      }}
    >
      <h3>
        {plan
          ? "The session plan"
          : draft.kind === "private"
            ? "Just for you"
            : "Add to the session record"}
      </h3>
      <p className="note-help">
        {draft.kind === "private"
          ? "Only you can read this note and its videos."
          : "Your session partner can read this note and its videos."}
      </p>
      {submitted && invalidFields.length > 0 && (
        <div role="alert" className="note-error">
          <strong>Check these fields. Your draft is still here.</strong>
          <ul>
            {invalidFields.map((issue) => (
              <li key={issue.id}>
                <a
                  href={`#${issue.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    form.current
                      ?.querySelector<HTMLElement>(`[id="${issue.id}"]`)
                      ?.focus();
                  }}
                >
                  {issue.label}: {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label htmlFor={bodyId}>{plan ? "Training plan" : "Your note"}</label>
      <textarea
        id={bodyId}
        ref={field}
        value={body}
        rows={5}
        disabled={disabled}
        required={!plan}
        aria-invalid={(submitted && !!bodyError) || undefined}
        aria-describedby={`${bodyId}-count${submitted && bodyError ? ` ${bodyId}-error` : ""}`}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          plan
            ? "What are we focusing on?"
            : "A useful detail, a small win, or something to try next time…"
        }
      />
      <p
        id={`${bodyId}-count`}
        className={`note-count${characters > limit ? " note-field-error" : ""}`}
      >
        {characters.toLocaleString("en-GB")} / {limit.toLocaleString("en-GB")}{" "}
        characters
      </p>
      {submitted && bodyError && (
        <p id={`${bodyId}-error`} className="note-field-error">
          {bodyError}
        </p>
      )}
      <VideoLinkEditor
        id={videoId}
        videos={videos}
        onChange={setVideos}
        disabled={disabled}
        errors={submitted ? videoErrors : undefined}
      />
      {preparationError && (
        <p role="alert" className="note-error">
          {preparationError}
        </p>
      )}
      {conflict && (
        <div className="note-conflict" role="alert">
          <strong>The latest saved version</strong>
          <blockquote>{conflict.current?.body || "No saved text"}</blockquote>
          <VideoLinks videos={conflict.current?.videos ?? []} />
          <p>Your draft above has not changed.</p>
          <button
            type="button"
            className="note-reload"
            onClick={() => {
              setBody(conflict.current?.body ?? "");
              setVideos(conflict.current?.videos ?? []);
              setRevision(conflict.current?.revision ?? 0);
              setSubmitted(false);
              setPreparationError("");
              onUseSaved(conflict.current);
            }}
          >
            Replace my draft with saved version
          </button>
        </div>
      )}
      <div className="note-actions">
        <button
          type="submit"
          className="note-save"
          disabled={disabled || !!conflict}
        >
          {plan ? "Save plan" : "Save note"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
