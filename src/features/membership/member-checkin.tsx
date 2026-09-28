"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Clipboard,
  Clock3,
  Dumbbell,
  History,
  MapPin,
  QrCode,
  RotateCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type {
  MemberClassSchedule,
  MemberClassSession,
} from "@/domain/class-reservations";
import type { MembershipCheckinSnapshot } from "@/domain/membership-checkins";
import type { MembershipGymSnapshot } from "@/domain/membership-activation";
import {
  arrivalCountdown,
  cancelMemberArrivalRequest,
  clearStoredArrivalPresentation,
  createMemberArrivalRequest,
  fetchMemberCheckinSnapshot,
  readStoredArrivalPresentation,
  reservationArrivalWindow,
  storeArrivalPresentation,
  terminalArrivalStatus,
  type StoredArrivalPresentation,
} from "./checkin-client";

type ArrivalTarget = Readonly<{
  key: string;
  venueId: string;
  venueName: string;
  reservationId: string | null;
  classTitle: string | null;
  serviceDate: string | null;
}>;

type TransientPendingArrival = ArrivalTarget &
  Readonly<{
    requestId: string;
    operationId: string;
    expiresAt: string;
    createdAt: string;
  }>;

type TerminalNotice = Readonly<{
  status: "confirmed" | "expired" | "cancelled";
  venueName: string;
  classTitle: string | null;
}>;

const arrivalPollMilliseconds = 4_000;

function classTime(session: MemberClassSession) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: session.timezone,
  });
  return formatter.format(new Date(session.startsAt));
}

function arrivalOpensAt(session: MemberClassSession) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: session.timezone,
  }).format(new Date(Date.parse(session.startsAt) - 30 * 60 * 1_000));
}

function serviceDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function confirmedAtLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function mutationMessage(status: string) {
  switch (status) {
    case "too-early":
      return "Arrival is not open yet. It opens 30 minutes before the class.";
    case "too-late":
      return "That class has ended, so an arrival code can no longer be created.";
    case "daily-conflict":
      return "Another included visit is already held or confirmed for that venue-local day.";
    case "allowance-exhausted":
      return "Your Basic membership has no unheld included visits remaining.";
    case "reservation-unavailable":
      return "That reservation is no longer eligible for arrival. Refresh the class schedule.";
    case "venue-unavailable":
      return "That gym is not in this active membership period.";
    case "no-active-membership":
      return "No active membership is available for this arrival.";
    case "operation-conflict":
      return "This arrival attempt no longer matches the selected gym. Start again.";
    case "signed-out":
      return "Your session ended. Sign in again before creating an arrival code.";
    case "forbidden":
      return "This account is not allowed to create that arrival request.";
    default:
      return "The arrival service is temporarily unavailable. No replacement request was submitted automatically.";
  }
}

const terminalMessages: Record<TerminalNotice["status"], string> = {
  confirmed:
    "Gym staff confirmed your attendance. Your private history and allowance now reflect the visit.",
  expired:
    "The arrival code expired without confirmation. It did not become attendance.",
  cancelled: "The pending arrival was cancelled. It did not become attendance.",
};

function selectedVenueTargets(
  coreGyms: readonly MembershipGymSnapshot[],
  schedule: MemberClassSchedule | null,
) {
  const scheduleVenues = new Map<string, MemberClassSession["venue"]>();
  for (const session of schedule?.sessions ?? []) {
    scheduleVenues.set(session.venue.slug, session.venue);
  }
  return coreGyms.map((gym) => ({
    gym,
    venue: scheduleVenues.get(gym.id) ?? null,
  }));
}

function matchesTransientHistory(
  pending: TransientPendingArrival,
  snapshot: MembershipCheckinSnapshot,
) {
  return snapshot.history.some((entry) =>
    pending.reservationId
      ? entry.reservationId === pending.reservationId
      : entry.attendanceKind === "open_gym" &&
        entry.venueId === pending.venueId &&
        Date.parse(entry.confirmedAt) >= Date.parse(pending.createdAt),
  );
}

export function MemberCheckinPanel({
  initialSnapshot,
  schedule,
  coreGyms,
}: {
  initialSnapshot: MembershipCheckinSnapshot | null;
  schedule: MemberClassSchedule | null;
  coreGyms: readonly MembershipGymSnapshot[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [presentation, setPresentation] =
    useState<StoredArrivalPresentation | null>(null);
  const [transientPending, setTransientPending] =
    useState<TransientPendingArrival | null>(null);
  const [storageState, setStorageState] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [now, setNow] = useState<number | null>(null);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<TerminalNotice | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const operationIds = useRef(new Map<string, string>());
  const snapshotRef = useRef(snapshot);
  const transientRef = useRef(transientPending);
  const refreshInFlight = useRef(false);
  const expiryRefreshFor = useRef<string | null>(null);

  const serverPending = snapshot?.pendingArrival ?? null;
  const displayPending = serverPending ?? transientPending;
  const selectedVenues = useMemo(
    () => selectedVenueTargets(coreGyms, schedule),
    [coreGyms, schedule],
  );
  const reservedSessions = useMemo(
    () =>
      (schedule?.sessions ?? []).filter(
        (session) =>
          session.bookingStatus === "reserved" &&
          session.reservation?.status === "reserved",
      ),
    [schedule],
  );

  const clearPresentation = useCallback((requestId?: string) => {
    clearStoredArrivalPresentation(requestId);
    setPresentation(null);
  }, []);

  const finishArrival = useCallback(
    (
      status: TerminalNotice["status"],
      context: { venueName: string; classTitle: string | null },
      requestId?: string,
    ) => {
      setTerminal({
        status,
        venueName: context.venueName,
        classTitle: context.classTitle,
      });
      setTransientPending(null);
      transientRef.current = null;
      clearPresentation(requestId);
      operationIds.current.clear();
    },
    [clearPresentation],
  );

  const refreshSnapshot = useCallback(async () => {
    if (refreshInFlight.current) return false;
    refreshInFlight.current = true;
    setRefreshing(true);
    const result = await fetchMemberCheckinSnapshot();
    if (result.status === "ready") {
      const previous = snapshotRef.current?.pendingArrival ?? null;
      const transient = transientRef.current;
      const checkedAt = Date.now();
      let status: "confirmed" | "expired" | null = null;
      let context: {
        venueName: string;
        classTitle: string | null;
        requestId: string;
      } | null = null;
      if (previous && !result.snapshot.pendingArrival) {
        status = terminalArrivalStatus(previous, result.snapshot, checkedAt);
        context = {
          venueName: previous.venueName,
          classTitle: previous.classTitle,
          requestId: previous.requestId,
        };
      } else if (transient && !result.snapshot.pendingArrival) {
        status = matchesTransientHistory(transient, result.snapshot)
          ? "confirmed"
          : checkedAt >= Date.parse(transient.expiresAt)
            ? "expired"
            : null;
        context = {
          venueName: transient.venueName,
          classTitle: transient.classTitle,
          requestId: transient.requestId,
        };
      }
      setSnapshot(result.snapshot);
      snapshotRef.current = result.snapshot;
      if (result.snapshot.pendingArrival) {
        setTransientPending(null);
        transientRef.current = null;
      } else if (status && context) {
        finishArrival(status, context, context.requestId);
      }
      setNotice(null);
      refreshInFlight.current = false;
      setRefreshing(false);
      return true;
    }
    setNotice(
      "The latest arrival status could not be loaded. The last confirmed view remains on screen.",
    );
    refreshInFlight.current = false;
    setRefreshing(false);
    return false;
  }, [finishArrival]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    transientRef.current = transientPending;
  }, [transientPending]);

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const interval = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const pending = snapshot?.pendingArrival ?? transientPending;
    const timer = window.setTimeout(() => {
      const stored = readStoredArrivalPresentation();
      if (stored.status === "unavailable") {
        setStorageState("unavailable");
        return;
      }
      setStorageState("ready");
      if (!pending) {
        clearStoredArrivalPresentation();
        setPresentation(null);
        return;
      }
      setPresentation((current) => {
        if (current?.requestId === pending.requestId) return current;
        return stored.value?.requestId === pending.requestId
          ? stored.value
          : null;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot?.pendingArrival, transientPending]);

  useEffect(() => {
    if (!displayPending) return;
    const interval = window.setInterval(
      () => void refreshSnapshot(),
      arrivalPollMilliseconds,
    );
    return () => window.clearInterval(interval);
  }, [displayPending, refreshSnapshot]);

  useEffect(() => {
    if (
      !displayPending ||
      now === null ||
      now < Date.parse(displayPending.expiresAt) ||
      expiryRefreshFor.current === displayPending.requestId
    ) {
      return;
    }
    expiryRefreshFor.current = displayPending.requestId;
    void refreshSnapshot();
  }, [displayPending, now, refreshSnapshot]);

  async function startArrival(target: ArrivalTarget) {
    setMutationKey(target.key);
    setNotice(null);
    setTerminal(null);
    const operationId =
      operationIds.current.get(target.key) ?? crypto.randomUUID();
    operationIds.current.set(target.key, operationId);
    const result = await createMemberArrivalRequest({
      operationId,
      venueId: target.venueId,
      reservationId: target.reservationId,
    });
    if (
      result.status === "created" &&
      result.requestId &&
      result.expiresAt &&
      result.presentationCode
    ) {
      const stored: StoredArrivalPresentation = Object.freeze({
        version: 1,
        requestId: result.requestId,
        operationId,
        presentationCode: result.presentationCode,
        expiresAt: result.expiresAt,
      });
      const persisted = storeArrivalPresentation(stored);
      setStorageState(persisted ? "ready" : "unavailable");
      setPresentation(stored);
      const pending: TransientPendingArrival = Object.freeze({
        ...target,
        requestId: result.requestId,
        operationId,
        expiresAt: result.expiresAt,
        createdAt: new Date().toISOString(),
      });
      setTransientPending(pending);
      transientRef.current = pending;
      setNotice(
        persisted
          ? "One arrival code was created and saved for this browser tab. Waiting for gym confirmation."
          : "One arrival code was created, but browser session storage is unavailable. Keep this page open until gym confirmation.",
      );
      await refreshSnapshot();
    } else if (
      (result.status === "existing" || result.status === "pending-conflict") &&
      result.requestId
    ) {
      setNotice(
        "An arrival request already exists. The page will resume it without creating a replacement code.",
      );
      await refreshSnapshot();
    } else {
      if (result.status !== "unavailable") {
        operationIds.current.delete(target.key);
      }
      setNotice(mutationMessage(result.status));
    }
    setMutationKey(null);
  }

  async function cancelArrival() {
    if (!displayPending) return;
    setMutationKey("cancel");
    setNotice(null);
    const result = await cancelMemberArrivalRequest(displayPending.requestId);
    if (result.status === "cancelled" || result.status === "existing") {
      finishArrival("cancelled", displayPending, displayPending.requestId);
      await refreshSnapshot();
    } else if (result.status === "expired") {
      finishArrival("expired", displayPending, displayPending.requestId);
      await refreshSnapshot();
    } else if (result.status === "confirmed") {
      finishArrival("confirmed", displayPending, displayPending.requestId);
      await refreshSnapshot();
    } else {
      setNotice(
        result.status === "not-found"
          ? "That request no longer exists. Refresh its status before trying again."
          : mutationMessage(result.status),
      );
    }
    setMutationKey(null);
  }

  async function copyCode() {
    if (!presentation) return;
    try {
      await navigator.clipboard.writeText(presentation.presentationCode);
      setCopyNotice("Fallback code copied.");
    } catch {
      setCopyNotice("Copy was blocked. Select the fallback code manually.");
    }
  }

  const activePeriod = snapshot?.activePeriod ?? null;
  const basicAvailable =
    activePeriod?.planCode === "basic" && activePeriod.includedCheckins !== null
      ? Math.max(
          0,
          activePeriod.includedCheckins -
            activePeriod.includedCheckinsUsed -
            activePeriod.heldCheckins,
        )
      : null;
  const currentCode =
    displayPending && presentation?.requestId === displayPending.requestId
      ? presentation
      : null;
  const codeUnexpired =
    displayPending && now !== null
      ? now < Date.parse(displayPending.expiresAt)
      : true;

  return (
    <section className="member-checkin" aria-labelledby="member-checkin-title">
      <div className="member-checkin-heading">
        <div>
          <span className="eyebrow">ARRIVAL &amp; ATTENDANCE</span>
          <h2 id="member-checkin-title">Check in when you arrive.</h2>
          <p>
            Create a short-lived arrival code at a selected gym. Showing the
            code is not attendance; gym staff must confirm it.
          </p>
        </div>
        <button
          type="button"
          className="button secondary checkin-refresh"
          onClick={() => void refreshSnapshot()}
          disabled={refreshing || mutationKey !== null}
        >
          <RotateCw size={15} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>

      {activePeriod ? (
        <div className="checkin-policy" aria-label="Included visit status">
          <ShieldCheck size={18} aria-hidden="true" />
          {activePeriod.planCode === "basic" ? (
            <p>
              <strong>Basic:</strong> {basicAvailable} available ·{" "}
              {activePeriod.heldCheckins} held ·{" "}
              {activePeriod.includedCheckinsUsed} confirmed of{" "}
              {activePeriod.includedCheckins}. A hold is not a used visit.
            </p>
          ) : (
            <p>
              <strong>Classic:</strong> unlimited period access with one
              included visit held or confirmed per venue-local day. There is no
              numerical visit balance.
            </p>
          )}
        </div>
      ) : (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          Arrival status is temporarily unavailable. No code can be created
          until the private membership state loads.
        </div>
      )}

      {notice && (
        <div
          className="membership-message warning checkin-notice"
          role="status"
          aria-live="polite"
        >
          <CircleAlert size={17} aria-hidden="true" /> {notice}
        </div>
      )}

      {terminal && !displayPending && (
        <div
          className={`checkin-terminal ${terminal.status}`}
          role="status"
          aria-live="polite"
        >
          {terminal.status === "confirmed" ? (
            <Check size={18} aria-hidden="true" />
          ) : terminal.status === "cancelled" ? (
            <X size={18} aria-hidden="true" />
          ) : (
            <Clock3 size={18} aria-hidden="true" />
          )}
          <div>
            <strong>{terminalMessages[terminal.status]}</strong>
            <span>
              {terminal.venueName}
              {terminal.classTitle
                ? ` · ${terminal.classTitle}`
                : " · Open gym"}
            </span>
          </div>
        </div>
      )}

      {displayPending ? (
        <article className="arrival-code-card">
          <div className="arrival-code-context">
            <span className="eyebrow">ONE-TIME ARRIVAL CODE</span>
            <h3>{displayPending.venueName}</h3>
            <p>
              {displayPending.classTitle ?? "Open-gym visit"}
              {displayPending.serviceDate
                ? ` · ${serviceDateLabel(displayPending.serviceDate)}`
                : ""}
            </p>
            <div className="arrival-waiting" role="status" aria-live="polite">
              <span aria-hidden="true" />
              Waiting for gym confirmation
            </div>
            <time dateTime={displayPending.expiresAt}>
              Expires in{" "}
              <strong>
                {now === null
                  ? "--:--"
                  : arrivalCountdown(displayPending.expiresAt, now)}
              </strong>
            </time>
          </div>

          <div className="arrival-presentation">
            {storageState === "unavailable" && currentCode && (
              <div className="arrival-storage-warning" role="status">
                <CircleAlert size={16} aria-hidden="true" />
                This tab cannot save the one-time code. Keep the page open;
                reloading will require cancellation or expiry recovery.
              </div>
            )}
            {storageState === "checking" ? (
              <div className="arrival-code-recovery" role="status">
                Checking this browser tab for the one-time code…
              </div>
            ) : currentCode && codeUnexpired ? (
              <>
                <div className="arrival-qr">
                  <QRCodeSVG
                    value={currentCode.presentationCode}
                    size={196}
                    level="M"
                    marginSize={4}
                    bgColor="#ffffff"
                    fgColor="#203429"
                    title="One-time MovX arrival code"
                  />
                </div>
                <div className="arrival-fallback">
                  <span>Fallback code</span>
                  <code>{currentCode.presentationCode}</code>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void copyCode()}
                  >
                    <Clipboard size={14} aria-hidden="true" /> Copy code
                  </button>
                  {copyNotice && (
                    <small role="status" aria-live="polite">
                      {copyNotice}
                    </small>
                  )}
                </div>
              </>
            ) : !codeUnexpired ? (
              <div className="arrival-code-recovery" role="status">
                <Clock3 size={20} aria-hidden="true" />
                This code reached its server expiry. Refreshing the final
                status; it cannot be used as attendance.
              </div>
            ) : (
              <div className="arrival-code-recovery danger" role="alert">
                <CircleAlert size={20} aria-hidden="true" />
                <div>
                  <strong>The one-time code is not in this browser tab.</strong>
                  <p>
                    The server stores only its hash and cannot reveal it again.
                    Cancel this request or wait for it to expire before creating
                    a replacement.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="arrival-code-actions">
            <p>
              Keep this code private and show it only to staff at the named gym.
              A screenshot does not prove attendance.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => void cancelArrival()}
              disabled={mutationKey !== null}
            >
              <X size={15} aria-hidden="true" />
              {mutationKey === "cancel" ? "Cancelling…" : "Cancel arrival"}
            </button>
          </div>
        </article>
      ) : activePeriod ? (
        <div className="arrival-options">
          <section aria-labelledby="reserved-arrivals-title">
            <div className="arrival-option-heading">
              <QrCode size={18} aria-hidden="true" />
              <div>
                <h3 id="reserved-arrivals-title">Reserved class arrival</h3>
                <p>
                  The code opens 30 minutes before class and closes when class
                  ends.
                </p>
              </div>
            </div>
            {reservedSessions.length ? (
              <div className="arrival-option-list">
                {reservedSessions.map((session) => {
                  const windowStatus =
                    now === null
                      ? "checking"
                      : reservationArrivalWindow(session, now);
                  const target: ArrivalTarget = {
                    key: `reservation:${session.reservation!.id}`,
                    venueId: session.venue.id,
                    venueName: session.venue.name,
                    reservationId: session.reservation!.id,
                    classTitle: session.title,
                    serviceDate: session.serviceDate,
                  };
                  return (
                    <article className="arrival-option" key={session.id}>
                      <div>
                        <strong>{session.title}</strong>
                        <span>
                          <MapPin size={13} aria-hidden="true" />{" "}
                          {session.venue.name} · {classTime(session)}
                        </span>
                        {windowStatus === "too-early" && (
                          <small>
                            Arrival opens {arrivalOpensAt(session)}.
                          </small>
                        )}
                        {windowStatus === "closed" && (
                          <small>Arrival has closed for this class.</small>
                        )}
                      </div>
                      <button
                        type="button"
                        className="button dark"
                        disabled={
                          windowStatus !== "open" || mutationKey !== null
                        }
                        onClick={() => void startArrival(target)}
                      >
                        <QrCode size={15} aria-hidden="true" />
                        {mutationKey === target.key
                          ? "Creating…"
                          : windowStatus === "checking"
                            ? "Checking window…"
                            : windowStatus === "open"
                              ? "Show arrival code"
                              : windowStatus === "too-early"
                                ? "Not open yet"
                                : "Arrival closed"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="arrival-options-empty">
                No reserved class is waiting for arrival. Reserve a class below
                first.
              </p>
            )}
          </section>

          <section aria-labelledby="open-gym-arrivals-title">
            <div className="arrival-option-heading">
              <Dumbbell size={18} aria-hidden="true" />
              <div>
                <h3 id="open-gym-arrivals-title">Open-gym arrival</h3>
                <p>
                  Start only when you are at one of the gyms selected for this
                  membership.
                </p>
              </div>
            </div>
            <div className="arrival-option-list">
              {selectedVenues.map(({ gym, venue }) => {
                const target: ArrivalTarget | null = venue
                  ? {
                      key: `open:${venue.id}`,
                      venueId: venue.id,
                      venueName: gym.name,
                      reservationId: null,
                      classTitle: null,
                      serviceDate: null,
                    }
                  : null;
                const allowanceUnavailable = basicAvailable === 0;
                return (
                  <article className="arrival-option compact" key={gym.id}>
                    <div>
                      <strong>{gym.name}</strong>
                      <span>Selected core gym · one visit per local day</span>
                      {!venue && (
                        <small>
                          Venue details are unavailable. Reload the membership
                          schedule before checking in.
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        !target || allowanceUnavailable || mutationKey !== null
                      }
                      onClick={() => target && void startArrival(target)}
                    >
                      <QrCode size={15} aria-hidden="true" />
                      {target && mutationKey === target.key
                        ? "Creating…"
                        : allowanceUnavailable
                          ? "No visits available"
                          : "Start open-gym arrival"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <section
        className="checkin-history"
        aria-labelledby="checkin-history-title"
      >
        <div className="arrival-option-heading">
          <History size={18} aria-hidden="true" />
          <div>
            <h3 id="checkin-history-title">Confirmed attendance</h3>
            <p>Private history appears only after gym staff confirmation.</p>
          </div>
        </div>
        {snapshot?.history.length ? (
          <div className="checkin-history-list">
            {snapshot.history.map((entry) => (
              <article key={entry.checkinId}>
                <span className="checkin-history-icon">
                  <Check size={15} aria-hidden="true" />
                </span>
                <div>
                  <strong>{entry.classTitle ?? "Open-gym visit"}</strong>
                  <span>
                    {entry.venueName} · {serviceDateLabel(entry.serviceDate)}
                  </span>
                </div>
                <time dateTime={entry.confirmedAt}>
                  Confirmed {confirmedAtLabel(entry.confirmedAt)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <p className="arrival-options-empty">
            No staff-confirmed visits yet. Pending and expired arrivals never
            appear here.
          </p>
        )}
      </section>
    </section>
  );
}
