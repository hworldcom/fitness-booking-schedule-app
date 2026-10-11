"use client";

import {
  Ban,
  CalendarClock,
  Check,
  Clock3,
  History,
  MapPin,
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  acceptPrivateSessionRequestAction,
  closePrivateSessionOccurrenceAction,
  declinePrivateSessionRequestAction,
  loadOwnedCoachBookingRequestPageAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";
import type {
  CoachBookingRequestPage,
  CoachBookingRequestPageCursor,
  OwnedCoachBookingRequestProjection,
} from "@/domain/coach-booking-requests";
import {
  coachBookingRequestStatusLabel,
  groupCoachBookingRequestsByOccurrence,
  mergeCoachBookingRequestPages,
  type CoachBookingRequestOccurrenceGroup,
} from "./coach-booking-request-queue-model";

const BERLIN_TIMEZONE = "Europe/Berlin";

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
  return `${values.weekday} ${values.day} ${values.month}, ${values.hour}:${values.minute}`;
}

function sessionTime(group: CoachBookingRequestOccurrenceGroup) {
  return dateTimeParts(group.scheduledStartAt, group.coachTimezone);
}

function requestDeadline(request: OwnedCoachBookingRequestProjection) {
  return `${dateTimeParts(request.decisionDeadlineAt, BERLIN_TIMEZONE)} Berlin time`;
}

function RequestIdentity({
  request,
}: {
  request: OwnedCoachBookingRequestProjection;
}) {
  return (
    <div className="coach-request-identity">
      <Avatar
        initials={profileInitials(request.clientDisplayName)}
        color="blue"
        small
        imageUrl={request.clientAvatarUrl}
        alt=""
      />
      <div>
        <strong>{request.clientDisplayName}</strong>
        <span>
          <Clock3 size={13} aria-hidden="true" /> Decision by{" "}
          {requestDeadline(request)}
        </span>
      </div>
    </div>
  );
}

function RequestHistoryGroup({
  group,
}: {
  group: CoachBookingRequestOccurrenceGroup;
}) {
  return (
    <article
      className="coach-request-history-group"
      data-slot-id={group.slotId}
    >
      <header>
        <div>
          <strong>{sessionTime(group)}</strong>
          <span>
            <MapPin size={13} aria-hidden="true" /> {group.location.publicLabel}
          </span>
        </div>
      </header>
      <ul>
        {group.requests.map((request) => (
          <li key={request.id}>
            <RequestIdentity request={request} />
            <em className={`coach-request-status ${request.status}`}>
              {coachBookingRequestStatusLabel(request.status)}
            </em>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function CoachBookingRequestQueue({
  initialPage,
}: {
  initialPage: CoachBookingRequestPage<OwnedCoachBookingRequestProjection> | null;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState<
    readonly OwnedCoachBookingRequestProjection[]
  >(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] =
    useState<CoachBookingRequestPageCursor | null>(
      initialPage?.nextCursor ?? null,
    );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  const groups = useMemo(
    () => groupCoachBookingRequestsByOccurrence(requests),
    [requests],
  );
  const pendingGroups = groups
    .filter((group) => group.pendingCount > 0)
    .map((group) => ({
      ...group,
      requests: group.requests.filter(
        (request) => request.status === "pending",
      ),
    }));
  const historyGroups = groupCoachBookingRequestsByOccurrence(
    requests.filter((request) => request.status !== "pending"),
  );
  const pendingCount = pendingGroups.reduce(
    (count, group) => count + group.pendingCount,
    0,
  );

  async function runMutation(
    key: string,
    action: () => Promise<CoachMarketplaceActionResult>,
  ) {
    if (busyKey) return;
    setBusyKey(key);
    setResult(null);
    setPageMessage(null);
    try {
      const next = await action();
      if (next.status === "saved" || next.status === "conflict") {
        const refreshed = await loadOwnedCoachBookingRequestPageAction(null);
        if (refreshed.status === "loaded") {
          setRequests(refreshed.page.items);
          setNextCursor(refreshed.page.nextCursor);
        } else {
          setPageMessage(refreshed.message);
        }
      }
      setResult(next);
      if (next.status === "saved" && next.bookingId) {
        router.refresh();
      }
    } catch {
      setResult({
        status: "unavailable",
        message: "MovX could not verify that request. Nothing was changed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function loadMore() {
    if (!nextCursor || busyKey) return;
    setBusyKey("page");
    setPageMessage(null);
    try {
      const next = await loadOwnedCoachBookingRequestPageAction(nextCursor);
      if (next.status !== "loaded") {
        setPageMessage(next.message);
        return;
      }
      setRequests((current) =>
        mergeCoachBookingRequestPages(current, next.page.items),
      );
      setNextCursor(next.page.nextCursor);
    } catch {
      setPageMessage(
        "The next request page could not be verified. Nothing was changed.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="coach-request-queue" id="booking-requests">
      <div className="coach-request-queue-heading">
        <div>
          <span className="eyebrow">BOOKING REQUESTS</span>
          <h2>Choose who to confirm</h2>
          <p>
            Requests do not reserve an occurrence. Accepting one client creates
            the confirmed booking and closes the other pending requests for that
            time.
          </p>
        </div>
        <span className="coach-slot-count">
          {initialPage === null
            ? "Unavailable"
            : `${pendingCount} ${nextCursor ? "pending shown" : "pending"}`}
        </span>
      </div>

      {initialPage === null ? (
        <div className="coach-request-empty" role="alert">
          <ShieldAlert size={23} aria-hidden="true" />
          <div>
            <strong>Your request queue cannot be verified right now.</strong>
            <p>No candidate identity or request history is shown.</p>
          </div>
        </div>
      ) : pendingGroups.length === 0 ? (
        <div className="coach-request-empty" role="status">
          <UserRound size={23} aria-hidden="true" />
          <div>
            <strong>
              {nextCursor
                ? "No requests need a decision on this page."
                : "No requests need a decision."}
            </strong>
            <p>
              {nextCursor
                ? "Load more to check older request attempts."
                : "New client requests will appear here without holding the time."}
            </p>
          </div>
        </div>
      ) : (
        <div className="coach-request-group-list">
          {pendingGroups.map((group) => {
            const confirming = confirmingSlotId === group.slotId;
            const closeKey = `close:${group.slotId}`;
            return (
              <article
                className="coach-request-group"
                data-slot-id={group.slotId}
                key={group.slotId}
              >
                <header>
                  <div>
                    <span>
                      <CalendarClock size={16} aria-hidden="true" />
                      <strong>{sessionTime(group)}</strong>
                    </span>
                    <small>
                      <MapPin size={13} aria-hidden="true" />
                      {group.location.publicLabel}
                    </small>
                  </div>
                  <span className="coach-request-candidate-count">
                    <UsersRound size={14} aria-hidden="true" />
                    {group.pendingCount} pending
                  </span>
                </header>

                <ul className="coach-request-candidates">
                  {group.requests.map((request) => (
                    <li key={request.id}>
                      <RequestIdentity request={request} />
                      <div className="coach-request-actions">
                        <button
                          type="button"
                          className="button dark"
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runMutation(`accept:${request.id}`, () =>
                              acceptPrivateSessionRequestAction(request.id),
                            )
                          }
                        >
                          <Check size={15} aria-hidden="true" />
                          {busyKey === `accept:${request.id}`
                            ? "Accepting…"
                            : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runMutation(`decline:${request.id}`, () =>
                              declinePrivateSessionRequestAction(request.id),
                            )
                          }
                        >
                          <X size={15} aria-hidden="true" />
                          {busyKey === `decline:${request.id}`
                            ? "Declining…"
                            : "Decline"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {confirming ? (
                  <div
                    className="coach-request-close-confirmation"
                    role="group"
                    aria-label={`Close ${sessionTime(group)}`}
                  >
                    <p>
                      Close this one occurrence and every pending request? Your
                      recurring schedule will not change.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busyKey !== null}
                        onClick={() => setConfirmingSlotId(null)}
                      >
                        Keep open
                      </button>
                      <button
                        type="button"
                        className="button danger"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void runMutation(closeKey, () =>
                            closePrivateSessionOccurrenceAction(group.slotId),
                          ).finally(() => setConfirmingSlotId(null))
                        }
                      >
                        <Ban size={15} aria-hidden="true" />
                        {busyKey === closeKey ? "Closing…" : "Close occurrence"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="coach-request-close-trigger"
                    disabled={busyKey !== null}
                    onClick={() => setConfirmingSlotId(group.slotId)}
                  >
                    <Ban size={14} aria-hidden="true" /> Close this occurrence
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div className="coach-request-pagination">
          <button
            type="button"
            className="button secondary"
            disabled={busyKey !== null}
            onClick={() => void loadMore()}
          >
            {busyKey === "page" ? "Loading…" : "Load more requests"}
          </button>
        </div>
      )}

      {historyGroups.length > 0 && (
        <details className="coach-request-history">
          <summary>
            <History size={15} aria-hidden="true" /> Recent request history (
            {historyGroups.reduce(
              (count, group) => count + group.requests.length,
              0,
            )}
            )
          </summary>
          <p>
            These request attempts have ended and cannot be changed. A terminal
            request does not mean the training session was completed.
          </p>
          <div>
            {historyGroups.map((group) => (
              <RequestHistoryGroup group={group} key={group.slotId} />
            ))}
          </div>
        </details>
      )}

      {pageMessage && (
        <p className="coach-client-message error" role="alert">
          {pageMessage}
        </p>
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
