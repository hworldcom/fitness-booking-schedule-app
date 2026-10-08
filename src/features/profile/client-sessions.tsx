"use client";

import {
  CalendarCheck2,
  Clock3,
  MapPin,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelPrivateBookingAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import {
  clientBookingTimeline,
  isFutureConfirmedBooking,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";

function bookingTime(booking: PrivateBookingProjection) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.coachTimezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(booking.scheduledStartAt));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.coachTimezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time.format(new Date(booking.scheduledStartAt))}–${time.format(new Date(booking.scheduledEndAt))}`;
}

function statusLabel(booking: PrivateBookingProjection) {
  if (booking.status === "cancelled") {
    return booking.cancelledBy
      ? `Cancelled by ${booking.cancelledBy}`
      : "Cancelled";
  }
  return booking.status === "completed" ? "Completed" : "Confirmed";
}

export function ClientSessions({
  bookings,
  referenceTime,
}: {
  bookings: readonly PrivateBookingProjection[] | null;
  referenceTime: string;
}) {
  const router = useRouter();
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const timeline = bookings
    ? clientBookingTimeline(bookings, referenceTime)
    : null;

  async function cancelBooking(bookingId: string) {
    if (busyBookingId) return;
    setBusyBookingId(bookingId);
    setResult(null);
    try {
      const next = await cancelPrivateBookingAction(bookingId);
      setResult(next);
      if (next.status === "saved") router.refresh();
    } catch {
      setResult({
        status: "unavailable",
        message: "MovX could not verify that booking. Nothing was changed.",
      });
    } finally {
      setBusyBookingId(null);
    }
  }

  function bookingCard(booking: PrivateBookingProjection) {
    const cancellable = isFutureConfirmedBooking(booking, referenceTime);
    return (
      <article className="client-session-card" key={booking.id}>
        <header>
          <div>
            <span className="eyebrow">PRIVATE SESSION</span>
            <h4>
              <Link href={`/coaches/${booking.coachSlug}`}>
                {booking.coachDisplayName}
              </Link>
            </h4>
          </div>
          <span className={`coach-booking-status ${booking.status}`}>
            {statusLabel(booking)}
          </span>
        </header>
        <p>
          <Clock3 size={16} aria-hidden="true" />
          <strong>{bookingTime(booking)}</strong>
        </p>
        <p>
          <MapPin size={16} aria-hidden="true" />
          <span>
            {booking.location.gymName ?? "Independent training place"}
            <small>{booking.location.publicLabel}</small>
          </span>
        </p>
        {cancellable && (
          <button
            type="button"
            className="button secondary"
            disabled={busyBookingId !== null}
            onClick={() => void cancelBooking(booking.id)}
          >
            <RotateCcw size={15} aria-hidden="true" />
            {busyBookingId === booking.id ? "Cancelling…" : "Cancel session"}
          </button>
        )}
      </article>
    );
  }

  return (
    <section className="client-sessions" id="my-sessions">
      <header className="client-sessions-heading">
        <div>
          <span className="eyebrow">MY SESSIONS</span>
          <h1>Your private-session schedule</h1>
          <p>
            Every session shown here comes from your actor-scoped scheduling
            record.
          </p>
        </div>
        <span className="client-session-count">
          {bookings === null
            ? "Unavailable"
            : `${bookings.length} session${bookings.length === 1 ? "" : "s"}`}
        </span>
      </header>

      {bookings === null ? (
        <div className="client-sessions-state" role="alert">
          <ShieldAlert size={24} aria-hidden="true" />
          <div>
            <strong>Your sessions cannot be verified right now.</strong>
            <p>No cached or placeholder booking history was shown.</p>
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="client-sessions-state" role="status">
          <CalendarCheck2 size={24} aria-hidden="true" />
          <div>
            <strong>No sessions booked yet.</strong>
            <p>
              Choose an open hour on a coach profile. Your confirmed booking
              will appear here.
            </p>
            <Link className="text-link" href="/explore">
              Find a coach
            </Link>
          </div>
        </div>
      ) : (
        <div className="client-session-groups">
          {timeline && timeline.upcoming.length > 0 && (
            <section aria-labelledby="upcoming-sessions-title">
              <div className="client-session-group-heading">
                <h3 id="upcoming-sessions-title">Upcoming</h3>
                <span>{timeline.upcoming.length}</span>
              </div>
              <div className="client-session-grid">
                {timeline.upcoming.map(bookingCard)}
              </div>
            </section>
          )}
          {timeline && timeline.history.length > 0 && (
            <section aria-labelledby="session-history-title">
              <div className="client-session-group-heading">
                <h3 id="session-history-title">History</h3>
                <span>{timeline.history.length}</span>
              </div>
              <div className="client-session-grid">
                {timeline.history.map(bookingCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {result && (
        <p
          className={`client-session-message ${result.status === "saved" ? "success" : "error"}`}
          role={result.status === "saved" ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
