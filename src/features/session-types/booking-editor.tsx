"use client";
import { ExternalClientPicker } from "@/features/external-clients/client-picker";
import type { ExternalClientPage } from "@/domain/external-clients";
import { SessionNotes } from "@/features/notes/session-notes";
import { berlinLocalInstant as berlinInstant } from "@/features/coach-events/contract";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionActorBoundary } from "./actor-boundary";
import {
  reloadSavedBooking,
  reviewCoachBooking,
  saveCoachBooking,
} from "./booking-client";

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
  externalClients: ExternalClientPage;
};
const START_TIME_GUIDANCE =
  "Choose a start time at :00, :15, :30 or :45 (15-minute intervals).";
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
export function BookingEditor({
  bookingId,
  coachView = !bookingId,
  returnHref,
  initialExternalClientId,
}: {
  bookingId?: string;
  coachView?: boolean;
  returnHref?: string;
  initialExternalClientId?: string;
}) {
  return (
    <section className="session-types-page">
      <Link
        href={returnHref ?? (coachView ? "/coach?view=bookings" : "/sessions")}
      >
        {coachView ? "← Bookings" : "← My training"}
      </Link>
      <h1>{bookingId ? "Session details" : "Schedule a client"}</h1>
      <SessionActorBoundary>
        {(identity) => (
          <Editor
            key={`${identity}:${bookingId ?? "new"}`}
            bookingId={bookingId}
            initialExternalClientId={initialExternalClientId}
          />
        )}
      </SessionActorBoundary>
    </section>
  );
}
function Editor({
  bookingId,
  initialExternalClientId,
}: {
  bookingId?: string;
  initialExternalClientId?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [detail, setDetail] = useState<SessionBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [typeId, setTypeId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [clientKind, setClientKind] = useState(
    initialExternalClientId ? "external" : "platform",
  );
  const [externalClientId, setExternalClientId] = useState(
    initialExternalClientId ?? "",
  );
  const [uncertain, setUncertain] = useState(false);
  const [clientPending, setClientPending] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [duration, setDuration] = useState<SessionDuration>(60);
  const [review, setReview] = useState<CoachSessionCommand | null>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const changeForm = useRef<HTMLFormElement>(null);
  const startInput = useRef<HTMLInputElement>(null);
  const rescheduleHandled = useRef(false);
  const [outsideWorkingHours, setOutsideWorkingHours] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailsNeedRefresh, setDetailsNeedRefresh] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const saveNotice = useRef<HTMLParagraphElement>(null);
  const saveController = useRef<AbortController | null>(null);
  useEffect(() => () => saveController.current?.abort(), []);
  useEffect(() => {
    if (!saveFeedback || !message || !saveNotice.current) return;
    saveNotice.current.focus({ preventScroll: true });
    saveNotice.current.scrollIntoView({ block: "center" });
  }, [message, saveFeedback]);
  const reviewId = review?.commandId;
  useEffect(() => {
    if (!reviewId || !reviewPanel.current) return;
    reviewPanel.current.focus({ preventScroll: true });
    reviewPanel.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [reviewId]);
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
  async function checkReview(command: CoachSessionCommand) {
    if (saveController.current) return;
    const controller = new AbortController();
    saveController.current = controller;
    setBusy(true);
    setReview(null);
    setSaveFeedback(true);
    setMessage("Checking this booking change…");
    try {
      const result = await reviewCoachBooking(command, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setOutsideWorkingHours(result.outsideWorkingHours);
      setReview(command);
      setMessage("");
      setSaveFeedback(false);
    } catch {
      if (!controller.signal.aborted)
        setMessage(
          "This change could not be reviewed. Check the full duration, venue and any overlapping sessions, then try Review again. Reload if the booking or class changed.",
        );
    } finally {
      saveController.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function save() {
    if (
      !review ||
      saveController.current ||
      (outsideWorkingHours && !review.outsideHoursConfirmed)
    )
      return;
    const controller = new AbortController();
    saveController.current = controller;
    setBusy(true);
    setSaveFeedback(true);
    setDetailsNeedRefresh(true);
    setMessage(detail ? "Saving booking change…" : "Saving session…");
    try {
      const r = await saveCoachBooking(review, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (r.status === "saved") {
        setUncertain(false);
        setSaved(true);
        setMessage("Session saved. Checking the latest details…");
        if (!bookingId) router.push(`/coach/sessions/${r.bookingId}`);
        else {
          try {
            const current = await reloadSavedBooking(bookingId, r.revision, {
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setDetail(current);
            setDetailsNeedRefresh(false);
            setMessage("Session saved.");
          } catch {
            if (controller.signal.aborted) return;
            setMessage("Session saved. Reload to view its latest details.");
          }
        }
      } else if (r.status === "outside-hours") {
        setOutsideWorkingHours(true);
        setUncertain(false);
        setDetailsNeedRefresh(false);
        setReview({
          ...review,
          commandId: crypto.randomUUID(),
          outsideHoursConfirmed: false,
        });
        setMessage("");
        setSaveFeedback(false);
      } else {
        setUncertain(
          !["invalid", "conflict", "forbidden", "signed-out"].includes(
            r.status,
          ),
        );
        setMessage(
          r.status === "conflict"
            ? "The class, connection, booking or time changed. Reload and review the current details."
            : r.status === "invalid"
              ? "Review the duration and Berlin start time."
              : r.status === "signed-out"
                ? "Your sign-in expired. Sign in again, then reload this booking before saving."
                : r.status === "forbidden"
                  ? "This account cannot change this booking. Reload to check your current access."
                  : "We couldn’t verify the save. Retry this exact review or reload to check the booking.",
        );
      }
    } catch {
      if (controller.signal.aborted) return;
      setUncertain(true);
      setMessage(
        "We couldn’t verify the save. Retry this exact review or reload to check the booking.",
      );
    } finally {
      saveController.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const editable =
    options &&
    (!detail ||
      (detail.status === "confirmed" && Date.parse(detail.startsAt) > now));
  useEffect(() => {
    if (
      loading ||
      !editable ||
      !detail ||
      rescheduleHandled.current ||
      window.location.hash !== "#reschedule" ||
      !changeForm.current
    )
      return;
    rescheduleHandled.current = true;
    changeForm.current.focus({ preventScroll: true });
    changeForm.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [loading, editable, detail]);
  const type = options?.types.find((t) => t.id === typeId);
  const selectedStart = berlinInstant(localTime);
  const invalidStartStep =
    selectedStart !== null && Date.parse(selectedStart) % 900000 !== 0;
  useEffect(() => {
    if (message !== START_TIME_GUIDANCE || !invalidStartStep) return;
    startInput.current?.focus({ preventScroll: true });
    startInput.current?.scrollIntoView({
      block: "center",
      behavior: "instant",
    });
  }, [message, invalidStartStep]);
  const activeTypes =
    options?.types.filter((t) => t.format === "private" && !t.archived) ?? [];
  const reloadHref = bookingId
    ? `${detail?.viewerIsCoach ? "/coach/sessions/" : "/sessions/"}${bookingId}`
    : "/coach/bookings/new";
  return (
    <>
      {loading && <p role="status">Loading session…</p>}
      {detail && (
        <section className="session-type-editor">
          <h2>{detail.sessionType?.name ?? "Private session"}</h2>
          {detailsNeedRefresh && (
            <p>
              <strong>These details may be outdated.</strong> Reload to check
              the current schedule.
            </p>
          )}
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
          {detail.athleteId && (
            <Link href={`/messages?booking=${detail.bookingId}`}>
              Messages and session record
            </Link>
          )}
          {detail.externalClient && (
            <p>
              Client:{" "}
              <Link
                href={`/coach/athletes/external/${detail.externalClient.id}`}
              >
                {detail.externalClient.name}
              </Link>
            </p>
          )}
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
                  disabled={busy || uncertain || clientPending}
                  onClick={() => void olderChanges()}
                >
                  Load older changes
                </button>
              )}
            </details>
          )}
        </section>
      )}
      <p
        ref={saveNotice}
        tabIndex={-1}
        className="session-booking-feedback"
        role="status"
        aria-live="polite"
      >
        {message}
        {saveFeedback && message && (
          <span className="session-booking-feedback-actions">
            {uncertain && (
              <button
                type="button"
                className="button dark"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy
                  ? "Saving…"
                  : detail
                    ? "Retry same change"
                    : "Retry same session"}
              </button>
            )}
            <a className="button secondary" href={reloadHref}>
              Reload current details
            </a>
          </span>
        )}
      </p>
      {detail && (
        <>
          {detail.viewerIsCoach && !detail.athleteId && (
            <p>
              Shared notes and the plan become visible to this client after they
              accept an invitation. Your private notes stay private.
            </p>
          )}
          <SessionNotes bookingId={detail.bookingId} />
        </>
      )}
      {editable && !detail && !saved && (
        <>
          <div className="session-type-editor">
            <label>
              Client type
              <select
                aria-label="Client type"
                value={clientKind}
                disabled={busy || uncertain || clientPending}
                onChange={(e) => {
                  setClientKind(e.target.value);
                  setReview(null);
                }}
              >
                <option value="platform">Connected athlete</option>
                <option value="external">External client</option>
              </select>
            </label>
          </div>
          {clientKind === "external" && (
            <ExternalClientPicker
              initial={options.externalClients}
              initialId={initialExternalClientId}
              value={externalClientId}
              onChange={(id) => {
                setExternalClientId(id);
                setReview(null);
              }}
              disabled={busy || uncertain}
              onPendingChange={(pending) => {
                setClientPending(pending);
                if (pending) setReview(null);
              }}
            />
          )}
        </>
      )}
      {editable && !saved && (
        <form
          ref={changeForm}
          id={detail ? "reschedule" : undefined}
          tabIndex={-1}
          aria-labelledby="booking-change-heading"
          className="session-type-editor session-booking-change"
          onSubmit={(e) => {
            e.preventDefault();
            const startsAt = berlinInstant(localTime);
            if (startsAt && Date.parse(startsAt) % 900000 !== 0) {
              setMessage(START_TIME_GUIDANCE);
              setSaveFeedback(false);
              startInput.current?.focus({ preventScroll: true });
              startInput.current?.scrollIntoView({
                block: "center",
                behavior: "instant",
              });
              return;
            }
            if (
              clientPending ||
              !startsAt ||
              !type ||
              (!detail &&
                !(clientKind === "external" ? externalClientId : athleteId))
            ) {
              setMessage(
                "Choose a valid, unambiguous Berlin time and current class.",
              );
              return;
            }
            setMessage("");
            setSaveFeedback(false);
            const command: CoachSessionCommand = {
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
                : {
                    action: "create",
                    ...(clientKind === "external"
                      ? { externalClientId }
                      : { athleteId }),
                  }),
            };
            if (detail) void checkReview(command);
            else {
              setOutsideWorkingHours(false);
              setReview(command);
            }
          }}
        >
          <h2 id="booking-change-heading">
            {detail ? "Change this booking" : "New confirmed session"}
          </h2>
          <p>
            {detail
              ? "Choose a free time. If the full session falls outside your saved working hours, we’ll ask you to confirm this one-booking exception. Your regular hours and session type stay the same."
              : "Use a free time within your saved availability. Your session type stays the same."}
          </p>
          {!detail && clientKind === "platform" && (
            <>
              <label>
                Athlete
                <select
                  required
                  aria-label="Athlete"
                  value={athleteId}
                  disabled={busy || uncertain || clientPending}
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
                  disabled={busy || uncertain || clientPending}
                  onClick={() => void more()}
                >
                  Load more athletes
                </button>
              )}
              {options.athletes.items.length === 0 && (
                <p>
                  Choose External client to book someone who hasn’t joined MovX.
                </p>
              )}
            </>
          )}
          <label>
            Session type
            <select
              required
              disabled={busy || uncertain || clientPending}
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
              disabled={busy || uncertain || clientPending}
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
                ref={startInput}
                type="datetime-local"
                required
                min="1970-01-01T00:00"
                step={900}
                aria-describedby="booking-start-guidance"
                aria-invalid={invalidStartStep || undefined}
                disabled={busy || uncertain || clientPending}
                value={localTime}
                onChange={(e) => {
                  e.currentTarget.setCustomValidity("");
                  setLocalTime(e.target.value);
                  setReview(null);
                  if (message === START_TIME_GUIDANCE) setMessage("");
                }}
                onInvalid={(e) => {
                  if (e.currentTarget.validity.stepMismatch) {
                    e.currentTarget.setCustomValidity(START_TIME_GUIDANCE);
                    setMessage(START_TIME_GUIDANCE);
                    setSaveFeedback(false);
                    e.currentTarget.focus({ preventScroll: true });
                    e.currentTarget.scrollIntoView({
                      block: "center",
                      behavior: "instant",
                    });
                  }
                }}
              />
            </label>
            <label>
              Duration
              <select
                aria-label="Duration"
                value={duration}
                disabled={busy || uncertain || clientPending}
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
          <p id="booking-start-guidance">{START_TIME_GUIDANCE}</p>
          <button
            ref={reviewButton}
            type="submit"
            className="button dark"
            disabled={busy || uncertain || clientPending || !type}
          >
            Review {detail ? "change" : "session"}
          </button>
        </form>
      )}
      {review && !saved && (
        <section
          ref={reviewPanel}
          tabIndex={-1}
          className="session-type-editor session-booking-review"
          aria-label="Review booking change"
        >
          <h2>{detail ? "Confirm schedule change" : "Confirm session"}</h2>
          <p>
            {type?.name} · {duration} minutes
            <br />
            {dateLabel(review.startsAt)} –{" "}
            {dateLabel(
              new Date(
                Date.parse(review.startsAt) + review.durationMinutes * 60000,
              ).toISOString(),
            )}{" "}
            · {options?.locations.find((l) => l.id === locationId)?.name}
          </p>
          {outsideWorkingHours && (
            <div className="session-booking-hours-warning" role="note">
              <h3>Outside your working hours</h3>
              <p id="booking-hours-warning">
                This session extends beyond your saved working hours or falls on
                a day off. Do you want to reschedule it anyway? This changes
                only this booking; your regular availability stays the same.
              </p>
              <label className="session-booking-hours-confirmation">
                <input
                  type="checkbox"
                  checked={review.outsideHoursConfirmed === true}
                  disabled={busy || uncertain}
                  aria-describedby="booking-hours-warning"
                  onChange={(e) =>
                    setReview({
                      ...review,
                      outsideHoursConfirmed: e.target.checked,
                    })
                  }
                />
                Reschedule outside my saved working hours
              </label>
            </div>
          )}
          <p>
            {detail
              ? "Messages and notes stay with this booking. Original schedule details remain in its change history."
              : clientKind === "external"
                ? "This reserves a confirmed session for the selected external client. They gain shared history access after accepting an invitation."
                : "This coach action confirms the session for the selected connected athlete."}
          </p>
          {!uncertain && (
            <button
              type="button"
              className="button dark"
              disabled={
                busy ||
                clientPending ||
                (outsideWorkingHours && !review.outsideHoursConfirmed)
              }
              onClick={() => void save()}
            >
              {busy
                ? "Saving…"
                : detail
                  ? "Save booking change"
                  : "Confirm session"}
            </button>
          )}
          {!uncertain && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setReview(null);
                setOutsideWorkingHours(false);
                reviewButton.current?.focus();
              }}
            >
              Cancel review
            </button>
          )}
        </section>
      )}
      {!loading && !(saveFeedback && message) && (
        <a className="button secondary" href={reloadHref}>
          Reload current details
        </a>
      )}
    </>
  );
}
