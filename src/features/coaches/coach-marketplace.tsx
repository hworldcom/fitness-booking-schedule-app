"use client";

import { CalendarCheck2, Clock3, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  bookPrivateSessionAction,
  cancelPrivateBookingAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import {
  isFutureConfirmedBooking,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";
import type { PublicCoachAvailabilitySlot } from "@/domain/coaches";

type MarketplaceActor =
  | Readonly<{
      status: "authorized";
      bookings: readonly PrivateBookingProjection[];
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

type CoachMarketplaceProps = Readonly<{
  coachDisplayName: string;
  coachSlug: string;
  slots: readonly PublicCoachAvailabilitySlot[];
  actor: MarketplaceActor;
  referenceTime: string;
}>;

function slotDay(slot: PublicCoachAvailabilitySlot) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(slot.startsAt));
}

function slotTime(slot: PublicCoachAvailabilitySlot) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(slot.startsAt))}–${formatter.format(new Date(slot.endsAt))}`;
}

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

export function CoachMarketplace(props: CoachMarketplaceProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const bookings =
    props.actor.status === "authorized" ? props.actor.bookings : [];

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
        message: "MovX could not verify the schedule. Nothing was changed.",
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
        Book directly with {props.coachDisplayName} from their published
        scheduling availability.
      </p>
      {result && (
        <div
          className={`coach-marketplace-message ${result.status === "saved" ? "success" : "error"}`}
          role={result.status === "saved" ? "status" : "alert"}
          aria-live="polite"
        >
          <p>{result.message}</p>
          {result.status === "saved" && (
            <Link href="/profile#my-sessions">View my sessions</Link>
          )}
        </div>
      )}
      {props.actor.status !== "authorized" &&
        props.actor.status !== "unavailable" && (
          <Link
            className="button dark"
            href={`/sign-in?returnTo=${encodeURIComponent(`/coaches/${props.coachSlug}`)}`}
          >
            Sign in to book
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
            <Link className="text-link" href="/profile#my-sessions">
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
                    <span className={`coach-booking-status ${booking.status}`}>
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
                        void runAction(`cancel:${booking.id}`, () =>
                          cancelPrivateBookingAction(booking.id),
                        )
                      }
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      {busyKey === `cancel:${booking.id}`
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

      <section className="coach-open-slots" aria-labelledby="open-slots-title">
        <div className="coach-section-heading">
          <div>
            <span className="eyebrow">NEXT 7 DAYS</span>
            <h3 id="open-slots-title">
              {props.slots.length === 0
                ? "No open times right now."
                : `${props.slots.length} open hour${props.slots.length === 1 ? "" : "s"}.`}
            </h3>
          </div>
          <Clock3 size={23} aria-hidden="true" />
        </div>
        {props.slots.length === 0 ? (
          <p>
            Only database-backed open times appear. No placeholder inventory is
            shown.
          </p>
        ) : (
          <ol className="coach-bookable-slot-list">
            {props.slots.map((slot) => (
              <li key={slot.id}>
                <Clock3 size={18} aria-hidden="true" />
                <span>
                  <strong>{slotDay(slot)}</strong>
                  <small>
                    {slotTime(slot)} ·{" "}
                    {slot.location.gymName ?? "Independent place"}
                  </small>
                </span>
                {props.actor.status === "authorized" ? (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(`slot:${slot.id}`, () =>
                        bookPrivateSessionAction(slot.id),
                      )
                    }
                  >
                    {busyKey === `slot:${slot.id}`
                      ? "Booking…"
                      : "Book this hour"}
                  </button>
                ) : (
                  <Link
                    className="button secondary"
                    href={`/sign-in?returnTo=${encodeURIComponent(`/coaches/${props.coachSlug}`)}`}
                  >
                    Sign in to book
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {props.actor.status === "unavailable" && (
        <p className="coach-marketplace-message error" role="alert">
          Your personal bookings are unavailable. No schedule history was shown.
        </p>
      )}
    </aside>
  );
}
