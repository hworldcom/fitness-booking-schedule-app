"use client";

import {
  CalendarCheck2,
  Check,
  RotateCcw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelPrivateBookingAction,
  completePrivateBookingAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";

function bookingTime(booking: PrivateBookingProjection) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: booking.coachTimezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(booking.scheduledStartAt));
}

export function CoachClientCards({
  bookings,
  referenceTime,
}: {
  bookings: readonly PrivateBookingProjection[] | null;
  referenceTime: string;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const referenceTimestamp = new Date(referenceTime).getTime();

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
      if (next.status === "saved") router.refresh();
    } catch {
      setResult({
        status: "unavailable",
        message: "MovX could not verify that booking. Nothing was changed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="coach-client-cards" id="client-bookings">
      <div className="coach-client-cards-heading">
        <div>
          <span className="eyebrow">BOOKED SCHEDULE</span>
          <h2>Private sessions</h2>
          <p>Review who booked each session and manage its current status.</p>
        </div>
        <span className="coach-slot-count">
          {bookings === null
            ? "Unavailable"
            : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {bookings === null ? (
        <div className="coach-client-cards-empty" role="alert">
          <ShieldAlert size={23} aria-hidden="true" />
          <div>
            <strong>Your booking schedule cannot be verified right now.</strong>
            <p>No client or booking history is shown.</p>
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="coach-client-cards-empty" role="status">
          <UserRound size={23} aria-hidden="true" />
          <div>
            <strong>No private sessions booked yet.</strong>
            <p>
              Confirmed bookings appear after a client reserves an open hour.
            </p>
          </div>
        </div>
      ) : (
        <div className="coach-client-card-grid">
          {bookings.map((booking) => {
            const future =
              new Date(booking.scheduledStartAt).getTime() > referenceTimestamp;
            const cancellable = booking.status === "confirmed" && future;
            const completable = booking.status === "confirmed" && !future;
            return (
              <article className="coach-client-card" key={booking.id}>
                <header>
                  <Avatar
                    initials={profileInitials(booking.clientDisplayName)}
                    color="blue"
                    small
                    imageUrl={booking.clientAvatarUrl}
                    alt={`${booking.clientDisplayName}'s profile picture`}
                  />
                  <div>
                    <h3>{booking.clientDisplayName}</h3>
                    <span>{booking.location.publicLabel}</span>
                  </div>
                </header>
                <div className="coach-client-booking-heading">
                  <span>
                    <CalendarCheck2 size={15} aria-hidden="true" />
                    <strong>{bookingTime(booking)}</strong>
                  </span>
                  <em className={`coach-booking-status ${booking.status}`}>
                    {booking.status}
                  </em>
                </div>
                {cancellable && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(`cancel:${booking.id}`, () =>
                        cancelPrivateBookingAction(booking.id),
                      )
                    }
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    {busyKey === `cancel:${booking.id}`
                      ? "Cancelling…"
                      : "Cancel session"}
                  </button>
                )}
                {completable && (
                  <button
                    type="button"
                    className="button dark coach-complete-booking"
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(`complete:${booking.id}`, () =>
                        completePrivateBookingAction(booking.id),
                      )
                    }
                  >
                    <Check size={15} aria-hidden="true" />
                    {busyKey === `complete:${booking.id}`
                      ? "Saving…"
                      : "Mark completed"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {result && (
        <p
          className={`coach-client-message ${result.status === "saved" ? "success" : "error"}`}
          role={result.status === "saved" ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
