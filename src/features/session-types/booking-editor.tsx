"use client";
import { ExternalClientPicker } from "@/features/external-clients/client-picker";
import type { ExternalClientPage } from "@/domain/external-clients";
import { SessionNotes } from "@/features/notes/session-notes";
import { berlinLocalInstant as berlinInstant } from "@/features/coach-events/contract";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { SessionActorBoundary } from "./actor-boundary";
import { BookingStartPicker } from "./booking-start-picker";
import {
  reloadSavedBooking,
  submitCoachBooking,
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
  InitialSessionBooking,
} from "@/domain/typed-sessions";
import type {
  ConnectionPage,
  ConnectionProjection,
} from "@/domain/coach-athlete-connections";
import "./session-types.css";
type Options = {
  types: readonly SessionType[];
  locations: readonly { id: string; name: string }[];
  athletes?: ConnectionPage<ConnectionProjection>;
  externalClients?: ExternalClientPage;
};
const START_TIME_GUIDANCE =
  "Choose a start time at :00, :15, :30 or :45 (15-minute intervals).";
const START_TIME_REQUIRED = "Choose a date and time before saving.";
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
  embedded = false,
  initialBooking,
}: {
  bookingId?: string;
  coachView?: boolean;
  returnHref?: string;
  initialExternalClientId?: string;
  embedded?: boolean;
  initialBooking?: InitialSessionBooking;
}) {
  const Heading = embedded ? "h2" : "h1";
  return (
    <section
      className={`session-types-page${embedded ? " schedule-tab-content" : ""}`}
    >
      {!embedded && (
        <Link
          href={
            returnHref ?? (coachView ? "/coach?view=bookings" : "/sessions")
          }
        >
          ← Bookings
        </Link>
      )}
      <Heading>{bookingId ? "Session details" : "Schedule a client"}</Heading>
      <SessionActorBoundary initialIdentity={initialBooking?.identity}>
        {(identity, canUseInitial) => (
          <Editor
            key={`${identity}:${bookingId ?? "new"}`}
            coachView={coachView}
            bookingId={bookingId}
            initialExternalClientId={initialExternalClientId}
            initialDetail={
              canUseInitial &&
              initialBooking &&
              initialBooking.detail.bookingId === bookingId
                ? initialBooking.detail
                : undefined
            }
          />
        )}
      </SessionActorBoundary>
    </section>
  );
}
function Editor({
  coachView,
  bookingId,
  initialExternalClientId,
  initialDetail,
}: {
  coachView: boolean;
  bookingId?: string;
  initialExternalClientId?: string;
  initialDetail?: SessionBookingDetail;
}) {
  const router = useRouter();
  const bookingFormId = useId();
  const { actor } = useActor();
  const { session } = useAuthSession();
  const [options, setOptions] = useState<Options | null>(null);
  // A server snapshot is only an initial value. Refreshes must not replace a
  // user's in-progress change, and the actor boundary controls its lifetime.
  const [initial] = useState(initialDetail);
  const [detail, setDetail] = useState<SessionBookingDetail | null>(
    initial ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [typeId, setTypeId] = useState(initial?.sessionType?.id ?? "");
  const [athleteId, setAthleteId] = useState("");
  const [clientKind, setClientKind] = useState(
    initialExternalClientId ? "external" : "platform",
  );
  const [externalClientId, setExternalClientId] = useState(
    initialExternalClientId ?? "",
  );
  const [uncertain, setUncertain] = useState(false);
  const [clientPending, setClientPending] = useState(false);
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [localTime, setLocalTime] = useState(
    initial ? berlinInput(initial.startsAt) : "",
  );
  const [duration, setDuration] = useState<SessionDuration>(
    initial
      ? (((Date.parse(initial.endsAt) - Date.parse(initial.startsAt)) /
          60000) as SessionDuration)
      : 60,
  );
  const [pendingCommand, setPendingCommand] =
    useState<CoachSessionCommand | null>(null);
  const changeForm = useRef<HTMLFormElement>(null);
  const startInput = useRef<HTMLButtonElement>(null);
  const [pickingStart, setPickingStart] = useState(false);
  const pickerWasOpen = useRef(false);
  const rescheduleHandled = useRef(false);
  const [outsideWorkingHours, setOutsideWorkingHours] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSessionHref, setSavedSessionHref] = useState<string | null>(null);
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
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const d = initial
          ? { status: "ready", detail: initial }
          : bookingId
            ? await (
                await fetch(`/api/session-bookings?bookingId=${bookingId}`, {
                  cache: "no-store",
                })
              ).json()
            : null;
        if (!active) return;
        if (d && d.status !== "ready") {
          setDetailsNeedRefresh(true);
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
            await fetch(
              `/api/session-bookings?options=${bookingId ? "edit" : "1"}`,
              {
                cache: "no-store",
              },
            )
          ).json();
          if (
            active &&
            r.status === "ready" &&
            (bookingId || (r.athletes && r.externalClients))
          )
            setOptions(r);
          else if (active) {
            setDetailsNeedRefresh(true);
            setMessage(
              "Coach scheduling options are unavailable. Check your access and reload.",
            );
          }
        }
      } catch {
        if (active) {
          setDetailsNeedRefresh(true);
          setMessage("The session could not be verified. Reload to try again.");
        }
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
  }, [bookingId, initial]);
  async function more() {
    const athletes = options?.athletes;
    if (!options || !athletes?.nextCursor) return;
    setBusy(true);
    try {
      const r = await (
        await fetch(
          "/api/session-bookings?options=1&cursor=" +
            encodeURIComponent(JSON.stringify(athletes.nextCursor)),
          { cache: "no-store" },
        )
      ).json();
      if (r.status === "ready")
        setOptions({
          ...options,
          athletes: {
            items: [
              ...athletes.items,
              ...r.athletes.items.filter(
                (n: ConnectionProjection) =>
                  !athletes.items.some((p) => p.id === n.id),
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
  async function save(command = pendingCommand) {
    if (!command || saveController.current) return;
    let writeStarted = uncertain;
    const controller = new AbortController();
    saveController.current = controller;
    setBusy(true);
    setSaveFeedback(true);
    setDetailsNeedRefresh(true);
    setMessage(detail ? "Saving booking change…" : "Saving session…");
    try {
      const r = uncertain
        ? await saveCoachBooking(command, { signal: controller.signal })
        : await submitCoachBooking(command, {
            signal: controller.signal,
            onPrepared(prepared, outsideHours) {
              writeStarted = true;
              setPendingCommand(prepared);
              setOutsideWorkingHours(outsideHours);
            },
          });
      if (controller.signal.aborted) return;
      if (r.status === "saved") {
        setUncertain(false);
        setSaved(true);
        setMessage("Session saved. Checking the latest details…");
        if (!bookingId) {
          const href = `/coach/sessions/${r.bookingId}`;
          setSavedSessionHref(href);
          router.push(href);
        } else {
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
        setPendingCommand(null);
        setMessage(
          "Working hours changed again. Your draft is kept. Save again to check the current time.",
        );
      } else {
        setDetailsNeedRefresh(
          ["conflict", "forbidden", "signed-out"].includes(r.status),
        );
        setUncertain(
          !["invalid", "conflict", "forbidden", "signed-out"].includes(
            r.status,
          ),
        );
        setMessage(
          r.status === "conflict"
            ? "The class, connection, booking or time changed. Reload and check the current details."
            : r.status === "invalid"
              ? "Check the duration and Berlin start time."
              : r.status === "signed-out"
                ? "Your sign-in expired. Sign in again, then reload this booking before saving."
                : r.status === "forbidden"
                  ? "This account cannot change this booking. Reload to check your current access."
                  : "We couldn’t verify the save. Retry this exact submission or reload to check the booking.",
        );
      }
    } catch {
      if (controller.signal.aborted) return;
      setUncertain(writeStarted);
      if (!writeStarted) {
        setPendingCommand(null);
        setDetailsNeedRefresh(false);
      }
      setMessage(
        writeStarted
          ? "We couldn’t verify the save. Retry this exact submission or reload to check the booking."
          : "The time could not be checked. Your draft is kept; try saving again.",
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
  const pickerSuspended =
    actor.status !== "authorized" || session.status !== "signed-in";
  useEffect(() => {
    if (!pickingStart && pickerWasOpen.current && !pickerSuspended)
      startInput.current?.focus();
    pickerWasOpen.current = pickingStart;
  }, [pickingStart, pickerSuspended]);
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
  const reloadHref =
    savedSessionHref ??
    (bookingId
      ? `${coachView ? "/coach/sessions/" : "/sessions/"}${bookingId}`
      : "/coach/bookings/new");
  return (
    <>
      {loading && (
        <p role="status">
          {detail ? "Loading booking options…" : "Loading session…"}
        </p>
      )}
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
        {!busy && !loading && message && (uncertain || detailsNeedRefresh) && (
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
            {!uncertain && (
              <a className="button secondary" href={reloadHref}>
                {savedSessionHref
                  ? "View session"
                  : saveFeedback
                    ? "Load latest changes"
                    : "Try again"}
              </a>
            )}
          </span>
        )}
      </p>
      {outsideWorkingHours && (
        <p className="session-booking-hours-warning" role="note">
          Outside your working hours. This change applies only to this booking;
          your regular availability stays the same.
        </p>
      )}
      {detail && (
        <>
          {detail.viewerIsCoach && !detail.athleteId && (
            <p>
              Shared notes and the plan become visible to this athlete after
              they accept an invitation. Your private notes stay private.
            </p>
          )}
          <SessionNotes bookingId={detail.bookingId} />
        </>
      )}
      {editable && !saved && (
        <section className="session-type-editor session-booking-change">
          {!detail && options.athletes && options.externalClients && (
            <>
              <h2 id="booking-change-heading">New confirmed session</h2>
              <p>
                Choose a free time, even outside your saved availability. You
                don’t need to set working hours first. Your session type stays
                the same.
              </p>
              <label>
                Athlete
                <select
                  required
                  form={bookingFormId}
                  aria-label="Athlete"
                  value={clientKind === "external" ? "external" : athleteId}
                  disabled={busy || uncertain || clientPending}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientKind(
                      value === "external" ? "external" : "platform",
                    );
                    if (value !== "external") setAthleteId(value);
                    setPendingCommand(null);
                  }}
                >
                  <option value="">Choose athlete</option>
                  {options.athletes.items.map((a) => (
                    <option key={a.id} value={a.athleteProfileId}>
                      {a.athleteDisplayName}
                    </option>
                  ))}
                  <option value="external">Add external athlete</option>
                </select>
              </label>
              {clientKind === "platform" && options.athletes.nextCursor && (
                <button
                  type="button"
                  disabled={busy || uncertain || clientPending}
                  onClick={() => void more()}
                >
                  Load more athletes
                </button>
              )}
              {clientKind === "platform" &&
                options.athletes.items.length === 0 && (
                  <p>
                    Use Add external athlete to book someone who hasn’t joined
                    MovX.
                  </p>
                )}
              {clientKind === "external" && (
                <ExternalClientPicker
                  initial={options.externalClients}
                  initialId={initialExternalClientId}
                  value={externalClientId}
                  onChange={(id) => {
                    setExternalClientId(id);
                    setPendingCommand(null);
                  }}
                  disabled={busy || uncertain}
                  onPendingChange={(pending) => {
                    setClientPending(pending);
                    if (pending) setPendingCommand(null);
                  }}
                />
              )}
            </>
          )}
          <form
            ref={changeForm}
            id={detail ? "reschedule" : bookingFormId}
            tabIndex={-1}
            aria-labelledby="booking-change-heading"
            onSubmit={(e) => {
              e.preventDefault();
              if (pickingStart) return;
              const startsAt = berlinInstant(localTime);
              if (!startsAt || Date.parse(startsAt) % 900000 !== 0) {
                setMessage(
                  startsAt ? START_TIME_GUIDANCE : START_TIME_REQUIRED,
                );
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
              void save(command);
            }}
          >
            {detail && (
              <>
                <h2 id="booking-change-heading">Change this booking</h2>
                <p>
                  Choose a free time. Changes outside your saved working hours
                  show a warning and apply only to this booking. Your regular
                  hours and session type stay the same.
                </p>
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
                  setPendingCommand(null);
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
                  setPendingCommand(null);
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
              <div className="booking-start-field">
                <span>Start · Berlin time</span>
                <button
                  ref={startInput}
                  type="button"
                  className="booking-start-trigger"
                  aria-label="Start · Berlin time"
                  aria-haspopup="dialog"
                  aria-expanded={pickingStart && !pickerSuspended}
                  aria-describedby="booking-start-guidance"
                  disabled={busy || uncertain || clientPending}
                  onClick={() => setPickingStart(true)}
                >
                  <CalendarDays size={18} aria-hidden="true" />
                  {selectedStart
                    ? dateLabel(selectedStart)
                    : "Choose date and time"}
                </button>
              </div>
              <label>
                Duration
                <select
                  aria-label="Duration"
                  value={duration}
                  disabled={busy || uncertain || clientPending}
                  onChange={(e) => {
                    setDuration(Number(e.target.value) as SessionDuration);
                    setPendingCommand(null);
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
              type="submit"
              className="button dark"
              disabled={
                busy || uncertain || clientPending || pickingStart || !type
              }
            >
              {busy
                ? "Saving…"
                : detail
                  ? "Save booking change"
                  : "Schedule session"}
            </button>
          </form>
        </section>
      )}
      {pickingStart && editable && !saved && (
        <BookingStartPicker
          value={localTime}
          suspended={pickerSuspended || busy || uncertain || clientPending}
          onCancel={() => setPickingStart(false)}
          onApply={(value) => {
            if (value !== localTime) {
              setLocalTime(value);
              setPendingCommand(null);
              setOutsideWorkingHours(false);
              if (
                message === START_TIME_GUIDANCE ||
                message === START_TIME_REQUIRED
              )
                setMessage("");
            }
            setPickingStart(false);
          }}
        />
      )}
    </>
  );
}
