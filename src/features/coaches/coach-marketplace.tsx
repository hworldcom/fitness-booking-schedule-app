"use client";

import {
  CalendarCheck2,
  Clock3,
  Coins,
  RotateCcw,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  preparePrivateBookingAction,
  requestPrivateBookingCancellationAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import {
  formatCancellationWindow,
  shortenChainReference,
  type PublicCoachMarketplaceProps,
} from "@/domain/coach-marketplace";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import {
  prepareCoachPassOperationRequest,
  recoverCoachPassOperationRequest,
} from "@/solana/client/coach-pass-client";
import type {
  CoachPassOperationApiResult,
  PreparedCoachPassOperationResult,
} from "@/solana/coach-pass-operation";
import { CoachPassOperationReview } from "./coach-pass-operation-review";

type PersistedOperation = Readonly<{
  operationId: string;
  stage: "prepare" | "recover";
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function operationMessage(result: CoachPassOperationApiResult) {
  switch (result.status) {
    case "submitted":
      return "Submitted. Recover the finalized state before starting another operation.";
    case "finalized":
      return "Finalized coach-pass state verified.";
    case "failed":
      return "The operation failed without creating verified marketplace state.";
    case "expired":
      return "The prepared blockhash expired. Review a newly simulated operation before signing again.";
    case "signed-out":
    case "preview":
      return "Sign in before buying or booking.";
    case "forbidden":
      return "Link and connect the wallet authorized for this MovX account.";
    case "invalid-request":
      return "The selected operation was not accepted.";
    case "conflict":
      return "The pass, wallet, credit, or booking state changed. Refresh before trying again.";
    case "unavailable":
      return "MovX or Devnet is unavailable. No transaction was assumed to have succeeded.";
    case "prepared":
      return "Simulation passed. Review the exact terms before opening Phantom.";
  }
}

function storageKey(coachProfileId: string) {
  return `movx:coach-pass:${coachProfileId}`;
}

function readPersistedOperation(coachProfileId: string) {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(storageKey(coachProfileId)) ?? "null",
    ) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "operationId" in value &&
      typeof value.operationId === "string" &&
      UUID_PATTERN.test(value.operationId) &&
      "stage" in value &&
      (value.stage === "prepare" || value.stage === "recover")
    ) {
      return value as PersistedOperation;
    }
  } catch {
    // Corrupt browser hints never replace the server operation journal.
  }
  return null;
}

function persistOperation(
  coachProfileId: string,
  operation: PersistedOperation | null,
) {
  try {
    if (operation) {
      window.sessionStorage.setItem(
        storageKey(coachProfileId),
        JSON.stringify(operation),
      );
    } else {
      window.sessionStorage.removeItem(storageKey(coachProfileId));
    }
  } catch {
    // Recovery still remains available by the visible server operation ID.
  }
}

function slotDay(slot: PublicCoachMarketplaceProps["slots"][number]) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(slot.startsAt));
}

function slotTime(slot: PublicCoachMarketplaceProps["slots"][number]) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(slot.startsAt))}–${formatter.format(
    new Date(slot.endsAt),
  )}`;
}

function bookingTime(booking: PrivateBookingProjection) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(booking.scheduledStartAt));
}

function bookingStatus(status: PrivateBookingProjection["status"]) {
  return status.replaceAll("-", " ");
}

export function CoachMarketplace(props: PublicCoachMarketplaceProps) {
  const router = useRouter();
  const [prepared, setPrepared] =
    useState<PreparedCoachPassOperationResult | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const credit =
    props.actor.status === "authorized" ? props.actor.credit : null;
  const bookings =
    props.actor.status === "authorized" ? props.actor.bookings : [];
  const availableCredits = credit?.availableCredits ?? BigInt(0);

  function showResult(result: CoachPassOperationApiResult) {
    if (result.status === "prepared") {
      persistOperation(props.coachProfileId, {
        operationId: result.operationId,
        stage: "recover",
      });
      setPrepared(result);
      setMessage(operationMessage(result));
      setError(false);
      return;
    }
    setMessage(operationMessage(result));
    setError(result.status !== "submitted" && result.status !== "finalized");
    if (result.status === "finalized") {
      persistOperation(props.coachProfileId, null);
      router.refresh();
    }
  }

  async function prepareBookingOperation(operationId: string) {
    persistOperation(props.coachProfileId, {
      operationId,
      stage: "prepare",
    });
    const result = await prepareCoachPassOperationRequest({
      kind: "booking",
      operationId,
    });
    showResult(result);
  }

  useEffect(() => {
    const persisted = readPersistedOperation(props.coachProfileId);
    if (!persisted) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setBusyKey("recovery");
    });
    const request =
      persisted.stage === "prepare"
        ? prepareCoachPassOperationRequest({
            kind: "booking",
            operationId: persisted.operationId,
          })
        : recoverCoachPassOperationRequest(persisted.operationId);
    void request
      .then((result) => {
        if (active) showResult(result);
      })
      .catch(() => {
        if (active) {
          setMessage(
            "A previous operation is still recoverable, but MovX cannot read it right now. Do not start a duplicate.",
          );
          setError(true);
        }
      })
      .finally(() => {
        if (active) setBusyKey(null);
      });
    return () => {
      active = false;
    };
    // The recovery hint belongs to this coach and is intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.coachProfileId]);

  async function startPurchase(
    offer: Extract<
      PublicCoachMarketplaceProps["catalogue"],
      { status: "ready" }
    >["offers"][number],
  ) {
    if (busyKey || prepared) return;
    setBusyKey(`offer:${offer.address}`);
    setMessage(null);
    setError(false);
    try {
      showResult(
        await prepareCoachPassOperationRequest({
          kind: "purchase",
          coachProfileId: props.coachProfileId,
          coachAuthorityAddress: offer.coachAuthorityAddress,
          offerAddress: offer.address,
        }),
      );
    } catch {
      setMessage(
        "The offer could not be prepared. No wallet prompt opened and no EURC moved.",
      );
      setError(true);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAction(
    key: string,
    action: () => Promise<CoachMarketplaceActionResult>,
  ) {
    if (busyKey || prepared) return;
    setBusyKey(key);
    setMessage(null);
    setError(false);
    try {
      const result = await action();
      setMessage(result.message);
      setError(
        result.status !== "saved" && result.status !== "operation-required",
      );
      if (result.status === "operation-required" && result.operationId) {
        await prepareBookingOperation(result.operationId);
      } else if (result.status === "saved") {
        router.refresh();
      }
    } catch {
      setMessage(
        "MovX could not complete the booking request. No chain outcome was assumed.",
      );
      setError(true);
    } finally {
      setBusyKey(null);
    }
  }

  function closeReview() {
    setPrepared(null);
    setMessage(null);
    persistOperation(props.coachProfileId, null);
    router.refresh();
  }

  return (
    <aside className="public-coach-next coach-marketplace">
      <header className="coach-marketplace-heading">
        <Coins size={25} aria-hidden="true" />
        <div>
          <span className="eyebrow">DEVNET COACH PASS</span>
          <h2>Buy credits. Book a real open hour.</h2>
        </div>
      </header>
      <p>
        You supply the exact test EURC and approve with your linked wallet. MovX
        pays all SOL fees and account rent; you do not need test SOL.
      </p>

      {props.catalogue.status === "ready" ? (
        <div className="coach-offer-grid" aria-label="Coach pass offers">
          {props.catalogue.offers.map((offer) => (
            <article key={offer.address} className="coach-offer-card">
              <span>
                {offer.credits === 1 ? "Try one class" : "Train ten times"}
              </span>
              <strong>
                {offer.priceEurc} <small>test EURC</small>
              </strong>
              <p>
                {offer.credits} coach-specific credit
                {offer.credits === 1 ? "" : "s"} · no credit expiry
              </p>
              <a
                href={`https://explorer.solana.com/address/${offer.address}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Offer {shortenChainReference(offer.address)}
              </a>
              {props.actor.status === "authorized" ? (
                <button
                  type="button"
                  className="button dark"
                  disabled={busyKey !== null || prepared !== null}
                  onClick={() => void startPurchase(offer)}
                >
                  {busyKey === `offer:${offer.address}`
                    ? "Simulating…"
                    : "Review exact transaction"}
                </button>
              ) : (
                <Link
                  className="button dark"
                  href={`/sign-in?returnTo=${encodeURIComponent(`/coaches/${props.coachSlug}`)}`}
                >
                  Sign in to buy
                </Link>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="coach-marketplace-empty" role="status">
          <TicketCheck size={21} aria-hidden="true" />
          <strong>
            {props.catalogue.status === "not-published"
              ? "No eligible public pass is published yet."
              : "Pass offers cannot be verified right now."}
          </strong>
          <p>
            MovX does not substitute a placeholder address, price, or balance.
          </p>
        </div>
      )}

      <section className="coach-credit-summary" aria-label="Your coach credits">
        <div>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>Your verified balance with {props.coachDisplayName}</span>
        </div>
        {props.actor.status === "authorized" ? (
          credit ? (
            <dl>
              <div>
                <dt>Available</dt>
                <dd>{credit.availableCredits.toString()}</dd>
              </div>
              <div>
                <dt>Reserved</dt>
                <dd>{credit.reservedCredits.toString()}</dd>
              </div>
              <div>
                <dt>Total bought</dt>
                <dd>{credit.totalPurchased.toString()}</dd>
              </div>
            </dl>
          ) : (
            <p>No finalized coach-client credit ledger is indexed yet.</p>
          )
        ) : (
          <p>
            Sign in to see only your own verified balance and booking history.
          </p>
        )}
      </section>

      <section className="coach-booking-policy">
        <RotateCcw size={20} aria-hidden="true" />
        <p>
          Cancel by {formatCancellationWindow(props.earlyCancellationMinutes)}{" "}
          for an automatic credit return. Later requests wait for this coach’s
          approval; until then the credit stays reserved.
        </p>
      </section>

      <section className="coach-open-slots" aria-labelledby="open-slots-title">
        <div className="coach-section-heading">
          <div>
            <span className="eyebrow">PRIVATE TRAINING · NEXT 7 DAYS</span>
            <h3 id="open-slots-title">
              {props.slots.length === 0
                ? "No open times right now."
                : `${props.slots.length} open hour${props.slots.length === 1 ? "" : "s"}.`}
            </h3>
          </div>
          <CalendarCheck2 size={23} aria-hidden="true" />
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
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    props.actor.status !== "authorized" ||
                    !credit ||
                    availableCredits < BigInt(1) ||
                    busyKey !== null ||
                    prepared !== null
                  }
                  onClick={() =>
                    credit &&
                    void handleAction(`slot:${slot.id}`, () =>
                      preparePrivateBookingAction(
                        slot.id,
                        credit.creditProjectionId,
                      ),
                    )
                  }
                >
                  {busyKey === `slot:${slot.id}`
                    ? "Holding…"
                    : credit && availableCredits >= BigInt(1)
                      ? "Review booking"
                      : "Pass required"}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {bookings.length > 0 && (
        <section
          className="coach-client-bookings"
          aria-labelledby="your-bookings-title"
        >
          <div className="coach-section-heading">
            <div>
              <span className="eyebrow">YOUR BOOKINGS</span>
              <h3 id="your-bookings-title">Credit-backed classes</h3>
            </div>
          </div>
          <ul>
            {bookings.map((booking) => (
              <li key={booking.id}>
                <div>
                  <strong>{bookingTime(booking)}</strong>
                  <span className={`coach-booking-status ${booking.status}`}>
                    {bookingStatus(booking.status)}
                  </span>
                </div>
                <small>
                  Reservation{" "}
                  {shortenChainReference(booking.creditReservationAddress)}
                </small>
                {(booking.status === "confirmed" ||
                  booking.status === "pending") && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busyKey !== null || prepared !== null}
                    onClick={() =>
                      void handleAction(`cancel:${booking.id}`, () =>
                        requestPrivateBookingCancellationAction(booking.id),
                      )
                    }
                  >
                    {busyKey === `cancel:${booking.id}`
                      ? "Checking policy…"
                      : "Request cancellation"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && (
        <p
          className={`coach-marketplace-message ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      {prepared && (
        <CoachPassOperationReview
          prepared={prepared}
          onFinalized={() => {
            persistOperation(props.coachProfileId, null);
            router.refresh();
          }}
          onClose={closeReview}
        />
      )}
    </aside>
  );
}
