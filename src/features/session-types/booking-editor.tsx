"use client";
import { berlinLocalInstant as berlinInstant } from "@/features/coach-events/contract";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionActorBoundary } from "./actor-boundary";

import {
  SESSION_DURATIONS,
  type SessionType,
  type SessionDuration,
} from "@/domain/session-types";
import type {
  SessionBookingDetail,
  CoachSessionCommand,
} from "@/domain/typed-sessions";
import type {
  ConnectionPage,
  ConnectionProjection,
} from "@/domain/coach-athlete-connections";
import "./session-types.css";
type Options = {
  types: readonly SessionType[];
  locations: readonly { id: string; name: string }[];
  athletes: ConnectionPage<ConnectionProjection>;
};
const dateLabel = (s: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
function berlinInput(s: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(s));
  return parts.replace(" ", "T");
}
export function BookingEditor({ bookingId }: { bookingId?: string }) {
  return (
    <section className="session-types-page">
      <Link href="/coach?view=bookings">← Bookings</Link>
      <h1>{bookingId ? "Session details" : "Schedule a client"}</h1>
      <SessionActorBoundary>
        {(identity) => (
          <Editor
            key={`${identity}:${bookingId ?? "new"}`}
            bookingId={bookingId}
          />
        )}
      </SessionActorBoundary>
    </section>
  );
}
function Editor({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [detail, setDetail] = useState<SessionBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [typeId, setTypeId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [duration, setDuration] = useState<SessionDuration>(60);
  const [review, setReview] = useState<CoachSessionCommand | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const d = bookingId
          ? await (
              await fetch(`/api/session-bookings?bookingId=${bookingId}`, {
                cache: "no-store",
              })
            ).json()
          : null;
        if (!active) return;
        if (d && d.status !== "ready") {
          setMessage(
            "This session could not be verified for your account. Reload to try again.",
          );
          return;
        }
        if (d) {
          setDetail(d.detail);
          setLocationId(d.detail.locationId);
          setLocalTime(berlinInput(d.detail.startsAt));
          setDuration(
            ((Date.parse(d.detail.endsAt) - Date.parse(d.detail.startsAt)) /
              60000) as SessionDuration,
          );
          setTypeId(d.detail.sessionType?.id ?? "");
        }
        if (!d || d.detail.viewerIsCoach) {
          const r = await (
            await fetch("/api/session-bookings?options=1", {
              cache: "no-store",
            })
          ).json();
          if (active && r.status === "ready") setOptions(r);
          else if (active)
            setMessage(
              "Coach scheduling options are unavailable. Check your access and reload.",
            );
        }
      } catch {
        if (active)
          setMessage("The session could not be verified. Reload to try again.");
      } finally {
        if (active) {
          setLoading(false);
          setNow(Date.now());
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [bookingId]);
  async function more() {
    if (!options?.athletes.nextCursor) return;
    setBusy(true);
    try {
      const r = await (
        await fetch(
          "/api/session-bookings?options=1&cursor=" +
            encodeURIComponent(JSON.stringify(options.athletes.nextCursor)),
          { cache: "no-store" },
        )
      ).json();
      if (r.status === "ready")
        setOptions({
          ...options,
          athletes: {
            items: [
              ...options.athletes.items,
              ...r.athletes.items.filter(
                (n: ConnectionProjection) =>
                  !options.athletes.items.some((p) => p.id === n.id),
              ),
            ],
            nextCursor: r.athletes.nextCursor,
          },
        });
      else setMessage("More athletes could not be loaded.");
    } catch {
      setMessage("More athletes could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  async function olderChanges() {
    if (!detail?.nextHistoryRevision) return;
    setBusy(true);
    try {
      const r = await (
        await fetch(
          `/api/session-bookings?bookingId=${detail.bookingId}&beforeRevision=${detail.nextHistoryRevision}`,
          { cache: "no-store" },
        )
      ).json();
      if (r.status !== "ready")
        setMessage("Older changes could not be loaded. Try again.");
      else if (r.detail.revision !== detail.revision)
        setMessage(
          "This booking changed. Reload its current details before continuing.",
        );
      else
        setDetail({
          ...detail,
          changes: [
            ...detail.changes,
            ...r.detail.changes.filter(
              (c: SessionBookingDetail["changes"][number]) =>
                !detail.changes.some((p) => p.revision === c.revision),
            ),
          ],
          nextHistoryRevision: r.detail.nextHistoryRevision,
        });
    } catch {
      setMessage("Older changes could not be loaded. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!review) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await (
        await fetch("/api/session-bookings?coach=true", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(review),
        })
      ).json();
      if (r.status === "saved") {
        setSaved(true);
        setMessage("Session saved.");
        if (!bookingId) router.push(`/sessions/${r.bookingId}`);
        else {
          try {
            const current = await (
              await fetch(`/api/session-bookings?bookingId=${bookingId}`, {
                cache: "no-store",
              })
            ).json();
            if (current.status === "ready") setDetail(current.detail);
          } catch {
            setMessage("Session saved. Reload to view its latest details.");
          }
        }
      } else
        setMessage(
          r.status === "conflict"
            ? "The class, connection, booking or time changed. Reload and review the current details."
            : r.status === "invalid"
              ? "Review the duration and Berlin start time."
              : "We couldn’t verify the save. Retry this exact review or reload to check the booking.",
        );
    } catch {
      setMessage(
        "We couldn’t verify the save. Retry this exact review or reload to check the booking.",
      );
    } finally {
      setBusy(false);
    }
  }
  const editable =
    options &&
    (!detail ||
      (detail.status === "confirmed" && Date.parse(detail.startsAt) > now));
  const type = options?.types.find((t) => t.id === typeId);
  const activeTypes =
    options?.types.filter((t) => t.format === "private" && !t.archived) ?? [];
  return (
    <>
      {loading && <p role="status">Loading session…</p>}
      {detail && (
        <section className="session-type-editor">
          <h2>{detail.sessionType?.name ?? "Private session"}</h2>
          <p>
            {dateLabel(detail.startsAt)}–
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Berlin",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(detail.endsAt))}{" "}
            ·{" "}
            {(Date.parse(detail.endsAt) - Date.parse(detail.startsAt)) / 60000}{" "}
            minutes
          </p>
          <p>
            {detail.venueName} · {detail.status}
          </p>
          <Link href={`/messages?booking=${detail.bookingId}`}>
            Messages and session record
          </Link>
          {detail.changes.length > 0 && (
            <details>
              <summary>Schedule changes ({detail.historyTotal})</summary>
              {detail.changes.map((c) => (
                <p key={c.revision}>
                  {dateLabel(c.changedAt)}: moved from{" "}
                  {dateLabel(c.previousStart)} ({c.previousVenue}) to{" "}
                  {dateLabel(c.newTerms.startsAt)} ({c.newTerms.venue}).
                </p>
              ))}
              {detail.nextHistoryRevision && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void olderChanges()}
                >
                  Load older changes
                </button>
              )}
            </details>
          )}
        </section>
      )}
      {editable && !saved && (
        <form
          className="session-type-editor"
          onSubmit={(e) => {
            e.preventDefault();
            const startsAt = berlinInstant(localTime);
            if (!startsAt || !type) {
              setMessage(
                "Choose a valid, unambiguous Berlin time and current class.",
              );
              return;
            }
            setMessage("");
            setReview({
              commandId: crypto.randomUUID(),
              typeId: type.id,
              typeRevision: type.revision,
              locationId,
              startsAt,
              durationMinutes: duration,
              ...(detail
                ? {
                    action: "override",
                    bookingId: detail.bookingId,
                    expectedRevision: detail.revision,
                  }
                : { action: "create", athleteId }),
            });
          }}
        >
          <h2>{detail ? "Change this booking" : "New confirmed session"}</h2>
          <p>
            Use a free time within your saved availability. This changes one
            booking; your session type stays the same.
          </p>
          {!detail && (
            <>
              <label>
                Athlete
                <select
                  required
                  aria-label="Athlete"
                  value={athleteId}
                  disabled={busy}
                  onChange={(e) => {
                    setAthleteId(e.target.value);
                    setReview(null);
                  }}
                >
                  <option value="">Choose a connected athlete</option>
                  {options.athletes.items.map((a) => (
                    <option key={a.id} value={a.athleteProfileId}>
                      {a.athleteDisplayName}
                    </option>
                  ))}
                </select>
              </label>
              {options.athletes.nextCursor && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void more()}
                >
                  Load more athletes
                </button>
              )}
              {options.athletes.items.length === 0 && (
                <p>
                  An accepted connection is required. Invite an athlete from a
                  shared booking first.
                </p>
              )}
            </>
          )}
          <label>
            Session type
            <select
              required
              disabled={busy}
              aria-label="Session type"
              value={typeId}
              onChange={(e) => {
                const t = activeTypes.find((x) => x.id === e.target.value);
                setTypeId(e.target.value);
                if (t) {
                  setDuration(t.durationMinutes);
                  setLocationId(t.defaultLocationId ?? "");
                }
                setReview(null);
              }}
            >
              <option value="">Choose a class</option>
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.durationMinutes} min
                </option>
              ))}
            </select>
          </label>
          {activeTypes.length === 0 && (
            <Link href="/coach/session-types">
              Create or restore a private session type
            </Link>
          )}
          <label>
            Venue
            <select
              required
              aria-label="Venue"
              value={locationId}
              disabled={busy}
              onChange={(e) => {
                setLocationId(e.target.value);
                setReview(null);
              }}
            >
              <option value="">Choose a venue</option>
              {options.locations.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="session-type-fields">
            <label>
              Start · Berlin time
              <input
                type="datetime-local"
                required
                step={900}
                disabled={busy}
                value={localTime}
                onChange={(e) => {
                  setLocalTime(e.target.value);
                  setReview(null);
                }}
              />
            </label>
            <label>
              Duration
              <select
                aria-label="Duration"
                value={duration}
                disabled={busy}
                onChange={(e) => {
                  setDuration(Number(e.target.value) as SessionDuration);
                  setReview(null);
                }}
              >
                {SESSION_DURATIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="button dark" disabled={busy || !type}>
            Review {detail ? "change" : "session"}
          </button>
        </form>
      )}
      {review && !saved && (
        <section
          className="session-type-editor"
          aria-label="Review booking change"
        >
          <h2>{detail ? "Confirm schedule change" : "Confirm session"}</h2>
          <p>
            {type?.name} · {duration} minutes
            <br />
            {dateLabel(review.startsAt)} ·{" "}
            {options?.locations.find((l) => l.id === locationId)?.name}
          </p>
          <p>
            {detail
              ? "Messages and notes stay with this booking. Original schedule details remain in its change history."
              : "This coach action confirms the session for the selected connected athlete."}
          </p>
          <button
            className="button dark"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy
              ? "Saving…"
              : detail
                ? "Save booking change"
                : "Confirm session"}
          </button>
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!loading && (
        <a
          className="button secondary"
          href={bookingId ? `/sessions/${bookingId}` : "/coach/bookings/new"}
        >
          Reload current details
        </a>
      )}
    </>
  );
}
