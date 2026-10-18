"use client";
import { coachProfileHref } from "@/domain/coach-public-url";

import { CalendarCheck2, Clock3, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  cancelPrivateBookingAction,
  requestPrivateSessionAction,
  withdrawPrivateSessionRequestAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import type { ClientCoachBookingRequestProjection } from "@/domain/coach-booking-requests";
import {
  isFutureConfirmedBooking,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";
import type { PublicCoachAvailabilitySlot } from "@/domain/coaches";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { publicScheduleActorMatches } from "./public-schedule-model";
import { calendarDate } from "@/domain/coach-calendar";
import {
  publicScheduleHref,
  publicScheduleSelection,
  publicScheduleSlots,
} from "@/domain/public-coach-schedule";
import {
  PublicScheduleNavigation,
  publicScheduleDateLabel,
} from "./public-schedule-navigation";

const BERLIN_TIMEZONE = "Europe/Berlin";

type MarketplaceActor =
  | Readonly<{
      status: "authorized";
      actorProfileId: string;
      subject: string;
      actorIdentity: string;
      bookings: readonly PrivateBookingProjection[];
      pendingRequests: readonly ClientCoachBookingRequestProjection[];
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

type CoachMarketplaceProps = Readonly<{
  coachProfileId: string;
  coachDisplayName: string;
  coachSlug: string;
  publicPath?: string;
  slots: readonly PublicCoachAvailabilitySlot[];
  actor: MarketplaceActor;
  referenceTime: string;
  selectedDate?: string | string[];
  actions?: Readonly<{
    request: typeof requestPrivateSessionAction;
    withdraw: typeof withdrawPrivateSessionRequestAction;
    cancel: typeof cancelPrivateBookingAction;
  }>;
}>;

function dateTimeParts(timestamp: string, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  return (
    values.weekday +
    " " +
    values.day +
    " " +
    values.month +
    ", " +
    values.hour +
    ":" +
    values.minute
  );
}

function slotDay(slot: PublicCoachAvailabilitySlot) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: slot.coachTimezone,
      weekday: "long",
      day: "numeric",
      month: "short",
    })
      .formatToParts(new Date(slot.startsAt))
      .map((part) => [part.type, part.value]),
  );
  return values.weekday + " " + values.day + " " + values.month;
}

function clockTime(timestamp: string, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  return values.hour + ":" + values.minute;
}

function slotTime(slot: PublicCoachAvailabilitySlot) {
  return (
    clockTime(slot.startsAt, slot.coachTimezone) +
    "–" +
    clockTime(slot.endsAt, slot.coachTimezone)
  );
}

function requestState(slot: PublicCoachAvailabilitySlot) {
  switch (slot.requestEligibility) {
    case "requestable":
      return "Available to request";
    case "booked":
      return "Already booked";
    case "withdrawn":
      return "Closed by coach";
    case "unavailable":
      return "Unavailable";
  }
}

function bookingTime(booking: PrivateBookingProjection) {
  return dateTimeParts(booking.scheduledStartAt, booking.coachTimezone);
}

function requestDeadline(request: ClientCoachBookingRequestProjection) {
  return (
    dateTimeParts(request.decisionDeadlineAt, BERLIN_TIMEZONE) + " Berlin time"
  );
}

export function CoachMarketplace(props: CoachMarketplaceProps) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const allowed =
    props.actor.status !== "authorized" ||
    publicScheduleActorMatches(session, actor, props.actor);
  return (
    <>
      {!allowed && (
        <p role="alert" className="coach-marketplace-message error">
          Your account changed or could not be verified. Reload to see your
          current requests and bookings.
        </p>
      )}
      <CoachMarketplaceContent
        key={allowed ? "current" : "revoked"}
        {...props}
        actor={allowed ? props.actor : { status: "unavailable" }}
      />
    </>
  );
}

function CoachMarketplaceContent(props: CoachMarketplaceProps) {
  const router = useRouter();
  const selection = publicScheduleSelection(
    props.selectedDate,
    props.referenceTime,
  );
  const eligible = publicScheduleSlots(props.slots, props.referenceTime);
  const slots = selection.inHorizon
    ? eligible.filter((slot) => calendarDate(slot.startsAt) === selection.date)
    : [];
  const counts = new Map<string, number>();
  for (const slot of eligible) {
    const date = calendarDate(slot.startsAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const signIn =
    "/sign-in?returnTo=" +
    encodeURIComponent(
      publicScheduleHref(props.coachSlug, selection.date, props.publicPath),
    );
  const actions = props.actions ?? {
    request: requestPrivateSessionAction,
    withdraw: withdrawPrivateSessionRequestAction,
    cancel: cancelPrivateBookingAction,
  };
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const [pendingRequestOverrides, setPendingRequestOverrides] = useState<
    readonly ClientCoachBookingRequestProjection[]
  >([]);
  const [withdrawnRequestIds, setWithdrawnRequestIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const pendingBySlot = useMemo(() => {
    const serverPendingRequests =
      props.actor.status === "authorized" ? props.actor.pendingRequests : [];
    const requests = new Map<string, ClientCoachBookingRequestProjection>();
    for (const request of serverPendingRequests) {
      if (!withdrawnRequestIds.has(request.id)) {
        requests.set(request.slotId, request);
      }
    }
    for (const request of pendingRequestOverrides) {
      if (!withdrawnRequestIds.has(request.id)) {
        requests.set(request.slotId, request);
      }
    }
    return requests;
  }, [pendingRequestOverrides, props.actor, withdrawnRequestIds]);
  const bookings =
    props.actor.status === "authorized" ? props.actor.bookings : [];
  const isOwnSchedule =
    props.actor.status === "authorized" &&
    props.actor.actorProfileId === props.coachProfileId;

  async function runAction(
    key: string,
    action: () => Promise<CoachMarketplaceActionResult>,
  ) {
    if (busyKey) return;
    setBusyKey(key);
    setResult(null);
    try {
      const next = await action();
      setResult(next);
      if (next.status === "saved") {
        if (next.request?.status === "pending") {
          setPendingRequestOverrides((current) => [
            next.request!,
            ...current.filter(
              (request) =>
                request.id !== next.request!.id &&
                request.slotId !== next.request!.slotId,
            ),
          ]);
        } else if (next.requestStatus === "withdrawn" && next.requestId) {
          setWithdrawnRequestIds(
            (current) => new Set([...current, next.requestId!]),
          );
        }
        router.refresh();
      } else if (next.status === "conflict") {
        setPendingRequestOverrides([]);
        if (key.startsWith("withdraw:")) {
          const requestId = next.requestId ?? key.slice("withdraw:".length);
          setWithdrawnRequestIds((current) => new Set([...current, requestId]));
        }
        router.refresh();
      }
    } catch {
      setResult({
        status: "unavailable",
        message:
          "MovX could not verify the result. Refresh to check your requests and bookings before trying again.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <aside className="public-coach-next coach-marketplace">
      <header className="coach-marketplace-heading">
        <CalendarCheck2 size={25} aria-hidden="true" />
        <div>
          <span className="eyebrow">PRIVATE SCHEDULING</span>
          <h2>Choose one open hour.</h2>
        </div>
      </header>
      <p>
        Sessions with {props.coachDisplayName} require coach confirmation. A
        request remains unconfirmed until the coach accepts it.
      </p>
      {result && (
        <div
          className={
            "coach-marketplace-message " +
            (result.status === "saved" ? "success" : "error")
          }
          role={result.status === "saved" ? "status" : "alert"}
          aria-live="polite"
        >
          <p>{result.message}</p>
          {result.status === "saved" && result.request && (
            <div className="coach-request-saved-detail">
              <strong>Awaiting coach confirmation</strong>
              <span>
                {dateTimeParts(
                  result.request.scheduledStartAt,
                  result.request.coachTimezone,
                )}{" "}
                · {result.request.location.name}
              </span>
              <span>This session is not confirmed yet.</span>
              <small>Decision by {requestDeadline(result.request)}</small>
            </div>
          )}
          {result.status === "saved" && (
            <Link href="/sessions#booking-requests">View my sessions</Link>
          )}
        </div>
      )}
      {props.actor.status !== "authorized" &&
        props.actor.status !== "unavailable" && (
          <Link className="button dark" href={signIn}>
            Sign in for session requests
          </Link>
        )}

      {bookings.length > 0 && (
        <section
          className="coach-client-bookings"
          aria-labelledby="your-bookings-title"
        >
          <div className="coach-section-heading">
            <div>
              <span className="eyebrow">YOUR BOOKINGS</span>
              <h3 id="your-bookings-title">Your schedule with this coach</h3>
            </div>
            <Link className="text-link" href="/sessions#my-sessions">
              All sessions
            </Link>
          </div>
          <ul>
            {bookings.map((booking) => {
              const cancellable = isFutureConfirmedBooking(
                booking,
                props.referenceTime,
              );
              return (
                <li key={booking.id}>
                  <div>
                    <strong>{bookingTime(booking)}</strong>
                    <span className={"coach-booking-status " + booking.status}>
                      {booking.status}
                    </span>
                  </div>
                  <small>{booking.location.publicLabel}</small>
                  {cancellable && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void runAction("cancel:" + booking.id, () =>
                          actions.cancel(booking.id),
                        )
                      }
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      {busyKey === "cancel:" + booking.id
                        ? "Cancelling…"
                        : "Cancel booking"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        id="private-schedule"
        className="coach-open-slots public-schedule"
        aria-labelledby="open-slots-title"
      >
        <PublicScheduleNavigation
          slug={props.coachSlug}
          publicPath={props.publicPath}
          selection={selection}
          counts={counts}
        />
        {selection.invalid && (
          <p role="status">That date was invalid. Showing today’s schedule.</p>
        )}
        <div className="coach-section-heading">
          <div>
            <span className="eyebrow">NEXT 30 DAYS</span>
            <h3 id="open-slots-title">
              {publicScheduleDateLabel(selection.date)}
            </h3>
          </div>
          <Clock3 size={23} aria-hidden="true" />
        </div>
        {!selection.inHorizon ? (
          <p role="status">
            This date is outside the current 30-day request window. Choose a
            date between {publicScheduleDateLabel(selection.today, true)} and{" "}
            {publicScheduleDateLabel(selection.through, true)}.
          </p>
        ) : slots.length === 0 ? (
          <p role="status">
            No open hours on this date. Choose another date to see available
            times.
          </p>
        ) : (
          <ol className="coach-bookable-slot-list">
            {slots.map((slot) => {
              const pendingRequest = pendingBySlot.get(slot.id);
              return (
                <li key={slot.id} data-slot-id={slot.id}>
                  <Clock3 size={18} aria-hidden="true" />
                  <span>
                    <strong>{slotDay(slot)}</strong>
                    <small>
                      {slotTime(slot)} · {slot.location.name}
                    </small>
                    <small>{slot.location.label}</small>
                    <small>
                      {pendingRequest
                        ? "Awaiting coach confirmation"
                        : requestState(slot)}
                    </small>
                    {pendingRequest && (
                      <small>
                        Decision by {requestDeadline(pendingRequest)} · This
                        session is not confirmed yet.
                      </small>
                    )}
                  </span>
                  {pendingRequest ? (
                    <div className="coach-slot-request-actions">
                      <span className="coach-booking-status pending">
                        Requested
                      </span>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void runAction("withdraw:" + pendingRequest.id, () =>
                            actions.withdraw(pendingRequest.id),
                          )
                        }
                      >
                        {busyKey === "withdraw:" + pendingRequest.id
                          ? "Withdrawing…"
                          : "Withdraw request"}
                      </button>
                    </div>
                  ) : slot.requestEligibility !== "requestable" ? (
                    <span className="coach-booking-status">
                      {requestState(slot)}
                    </span>
                  ) : isOwnSchedule ? (
                    <button type="button" className="button secondary" disabled>
                      Your schedule
                    </button>
                  ) : props.actor.status === "authorized" ? (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void runAction("request:" + slot.id, () =>
                          actions.request(slot.id),
                        )
                      }
                    >
                      {busyKey === "request:" + slot.id
                        ? "Saving request…"
                        : "Request session"}
                    </button>
                  ) : props.actor.status === "unavailable" ? (
                    <button type="button" className="button secondary" disabled>
                      Requests unavailable
                    </button>
                  ) : (
                    <Link className="button secondary" href={signIn}>
                      Sign in to request
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <form
          action={coachProfileHref({
            slug: props.coachSlug,
            publicPath: props.publicPath,
          })}
        >
          <input type="hidden" name="date" value={selection.date} />
          <button type="submit" className="public-schedule-reload">
            Refresh available times
          </button>
        </form>
      </section>

      {props.actor.status === "unavailable" && (
        <p className="coach-marketplace-message error" role="alert">
          Session requests are unavailable because MovX could not verify your
          account. No personal schedule was shown.
        </p>
      )}
    </aside>
  );
}
