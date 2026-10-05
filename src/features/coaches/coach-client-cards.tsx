"use client";

import {
  CalendarCheck2,
  Check,
  CircleDollarSign,
  RotateCcw,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  decideLateBookingCancellationAction,
  preparePrivateBookingConsumptionAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import type {
  CoachClientCardProjection,
  PrivateBookingProjection,
} from "@/domain/coach-bookings";
import {
  formatCancellationWindow,
  shortenChainReference,
} from "@/domain/coach-marketplace";
import {
  prepareCoachPassOperationRequest,
  recoverCoachPassOperationRequest,
} from "@/solana/client/coach-pass-client";
import type {
  CoachPassOperationApiResult,
  PreparedCoachPassOperationResult,
} from "@/solana/coach-pass-operation";
import { CoachPassOperationReview } from "./coach-pass-operation-review";

const COACH_OPERATION_STORAGE_KEY = "movx:coach-pass:coach-workspace";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type PersistedOperation = Readonly<{
  operationId: string;
  stage: "prepare" | "recover";
}>;

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

function isCompletable(booking: PrivateBookingProjection) {
  return (
    (booking.status === "confirmed" || booking.status === "denied") &&
    new Date(booking.scheduledStartAt).getTime() <= Date.now()
  );
}

function readPersistedOperation(): PersistedOperation | null {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(COACH_OPERATION_STORAGE_KEY) ?? "null",
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
    // The server operation journal remains authoritative if this hint is bad.
  }
  return null;
}

function persistOperation(operation: PersistedOperation | null) {
  try {
    if (operation) {
      window.sessionStorage.setItem(
        COACH_OPERATION_STORAGE_KEY,
        JSON.stringify(operation),
      );
    } else {
      window.sessionStorage.removeItem(COACH_OPERATION_STORAGE_KEY);
    }
  } catch {
    // The visible recovery ID can still be used if browser storage is blocked.
  }
}

function operationMessage(result: CoachPassOperationApiResult) {
  switch (result.status) {
    case "prepared":
      return "Simulation passed. Review the exact credit movement before opening Phantom.";
    case "submitted":
      return "Submitted. Recover the finalized state before starting another operation.";
    case "finalized":
      return "Finalized coach-pass state verified.";
    case "failed":
      return "The operation failed without verified marketplace state.";
    case "expired":
      return "The prepared blockhash expired. Prepare and review a fresh operation.";
    case "signed-out":
    case "preview":
      return "Sign in to manage client bookings.";
    case "forbidden":
      return "Connect the wallet authorized for this coach account.";
    case "invalid-request":
      return "The operation request is invalid.";
    case "conflict":
      return "The booking or chain state changed. Refresh before trying again.";
    case "unavailable":
      return "MovX or Devnet is unavailable. No chain outcome was assumed.";
  }
}

export function CoachClientCards({
  cards,
  earlyCancellationMinutes,
}: {
  cards: readonly CoachClientCardProjection[] | null;
  earlyCancellationMinutes: number;
}) {
  const router = useRouter();
  const [prepared, setPrepared] =
    useState<PreparedCoachPassOperationResult | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function showOperation(result: CoachPassOperationApiResult) {
    setMessage(operationMessage(result));
    setError(
      result.status !== "prepared" &&
        result.status !== "submitted" &&
        result.status !== "finalized",
    );
    if (result.status === "prepared") {
      persistOperation({ operationId: result.operationId, stage: "recover" });
      setPrepared(result);
    } else if (result.status === "finalized") {
      persistOperation(null);
      router.refresh();
    }
  }

  async function prepareOperation(operationId: string) {
    persistOperation({ operationId, stage: "prepare" });
    showOperation(
      await prepareCoachPassOperationRequest({
        kind: "booking",
        operationId,
      }),
    );
  }

  useEffect(() => {
    const persisted = readPersistedOperation();
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
        if (active) showOperation(result);
      })
      .catch(() => {
        if (active) {
          setMessage(
            "A previous operation remains recoverable, but MovX cannot read it right now. Do not start a duplicate.",
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
    // Read the single workspace recovery hint once after mounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAction(
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
        await prepareOperation(result.operationId);
      } else if (result.status === "saved") {
        router.refresh();
      }
    } catch {
      setMessage(
        "MovX could not complete that booking action. No chain outcome was assumed.",
      );
      setError(true);
    } finally {
      setBusyKey(null);
    }
  }

  function finishReview() {
    persistOperation(null);
    setPrepared(null);
    setMessage(null);
    router.refresh();
  }

  return (
    <section className="coach-client-cards" id="client-cards">
      <div className="coach-client-cards-heading">
        <div>
          <span className="eyebrow">CLIENTS WITH VERIFIED CREDITS</span>
          <h2>Client cards</h2>
          <p>
            Cards join human booking context to the indexed coach-client ledger.
            They never manufacture credits from database records.
          </p>
        </div>
        <span className="coach-slot-count">
          {cards === null ? "Unavailable" : `${cards.length} clients`}
        </span>
      </div>

      {cards === null ? (
        <div className="coach-client-cards-empty" role="alert">
          <ShieldAlert size={23} aria-hidden="true" />
          <div>
            <strong>Client cards cannot be verified right now.</strong>
            <p>No client identity, balance, or booking history is shown.</p>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="coach-client-cards-empty" role="status">
          <UserRound size={23} aria-hidden="true" />
          <div>
            <strong>No verified pass holders yet.</strong>
            <p>
              A card appears only after a finalized pass purchase is indexed.
            </p>
          </div>
        </div>
      ) : (
        <div className="coach-client-card-grid">
          {cards.map((card) => (
            <article className="coach-client-card" key={card.clientProfileId}>
              <header>
                <UserRound size={20} aria-hidden="true" />
                <div>
                  <h3>{card.clientDisplayName}</h3>
                  <span title={card.clientWalletAddress}>
                    Wallet {shortenChainReference(card.clientWalletAddress)}
                  </span>
                </div>
              </header>
              <dl className="coach-client-credit-counts">
                <div>
                  <dt>Available</dt>
                  <dd>{card.availableCredits.toString()}</dd>
                </div>
                <div>
                  <dt>Reserved</dt>
                  <dd>{card.reservedCredits.toString()}</dd>
                </div>
                <div>
                  <dt>Total bought</dt>
                  <dd>{card.totalPurchased.toString()}</dd>
                </div>
              </dl>
              <a
                className="coach-client-ledger-link"
                href={`https://explorer.solana.com/address/${card.coachClientCreditsAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Ledger {shortenChainReference(card.coachClientCreditsAddress)}
              </a>
              {card.bookings.length === 0 ? (
                <p className="coach-client-no-bookings">No bookings yet.</p>
              ) : (
                <ul className="coach-client-booking-list">
                  {card.bookings.map((booking) => (
                    <li key={booking.id}>
                      <div className="coach-client-booking-heading">
                        <span>
                          <CalendarCheck2 size={15} aria-hidden="true" />
                          <strong>{bookingTime(booking)}</strong>
                        </span>
                        <em
                          className={`coach-booking-status ${booking.status}`}
                        >
                          {bookingStatus(booking.status)}
                        </em>
                      </div>
                      <small>
                        Reservation{" "}
                        {shortenChainReference(
                          booking.creditReservationAddress,
                        )}
                      </small>
                      {booking.status === "cancellation-requested" && (
                        <div className="coach-client-booking-actions">
                          <button
                            type="button"
                            className="button dark"
                            disabled={busyKey !== null || prepared !== null}
                            onClick={() =>
                              void runAction(`approve:${booking.id}`, () =>
                                decideLateBookingCancellationAction(
                                  booking.id,
                                  "approved",
                                ),
                              )
                            }
                          >
                            <Check size={15} aria-hidden="true" /> Approve
                            return
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={busyKey !== null || prepared !== null}
                            onClick={() =>
                              void runAction(`deny:${booking.id}`, () =>
                                decideLateBookingCancellationAction(
                                  booking.id,
                                  "denied",
                                ),
                              )
                            }
                          >
                            <X size={15} aria-hidden="true" /> Keep booking
                          </button>
                        </div>
                      )}
                      {isCompletable(booking) && (
                        <button
                          type="button"
                          className="button dark coach-complete-booking"
                          disabled={busyKey !== null || prepared !== null}
                          onClick={() =>
                            void runAction(`complete:${booking.id}`, () =>
                              preparePrivateBookingConsumptionAction(
                                booking.id,
                              ),
                            )
                          }
                        >
                          <CircleDollarSign size={15} aria-hidden="true" />
                          Complete class
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="coach-client-policy">
        <RotateCcw size={17} aria-hidden="true" /> Client cancellations made by{" "}
        {formatCancellationWindow(earlyCancellationMinutes)} return a credit
        automatically. Later requests require your explicit decision.
      </p>

      {message && (
        <p
          className={`coach-client-message ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      {prepared && (
        <CoachPassOperationReview
          prepared={prepared}
          onFinalized={finishReview}
          onClose={finishReview}
        />
      )}
    </section>
  );
}
