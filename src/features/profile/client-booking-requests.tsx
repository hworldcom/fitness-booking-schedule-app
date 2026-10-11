"use client";

import {
  CalendarClock,
  Clock3,
  History,
  MapPin,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  loadClientCoachBookingRequestPageAction,
  withdrawPrivateSessionRequestAction,
  type CoachMarketplaceActionResult,
} from "@/app/coach-marketplace-actions";
import type {
  ClientCoachBookingRequestProjection,
  CoachBookingRequestPage,
  CoachBookingRequestPageCursor,
} from "@/domain/coach-booking-requests";
import {
  clientBookingRequestGroups,
  clientBookingRequestStatusDescription,
  clientBookingRequestStatusLabel,
  mergeClientBookingRequestPages,
} from "./client-booking-request-model";

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

function requestTime(request: ClientCoachBookingRequestProjection) {
  return dateTimeParts(request.scheduledStartAt, request.coachTimezone);
}

function requestDeadline(request: ClientCoachBookingRequestProjection) {
  return (
    dateTimeParts(request.decisionDeadlineAt, BERLIN_TIMEZONE) + " Berlin time"
  );
}

export function ClientBookingRequests({
  initialPage,
}: {
  initialPage: CoachBookingRequestPage<ClientCoachBookingRequestProjection>;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialPage.items);
  const [nextCursor, setNextCursor] =
    useState<CoachBookingRequestPageCursor | null>(initialPage.nextCursor);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<CoachMarketplaceActionResult | null>(
    null,
  );
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const groups = useMemo(
    () => clientBookingRequestGroups(requests),
    [requests],
  );

  async function refreshFirstPage() {
    const refreshed = await loadClientCoachBookingRequestPageAction(null);
    if (refreshed.status === "loaded") {
      setRequests(refreshed.page.items);
      setNextCursor(refreshed.page.nextCursor);
      return;
    }
    setPageMessage(refreshed.message);
  }

  async function withdraw(requestId: string) {
    if (busyKey) return;
    setBusyKey("withdraw:" + requestId);
    setResult(null);
    setPageMessage(null);
    try {
      const next = await withdrawPrivateSessionRequestAction(requestId);
      setResult(next);
      if (next.status === "saved" || next.status === "conflict") {
        await refreshFirstPage();
      }
      if (next.status === "saved") router.refresh();
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
      const next = await loadClientCoachBookingRequestPageAction(nextCursor);
      if (next.status !== "loaded") {
        setPageMessage(next.message);
        return;
      }
      setRequests((current) =>
        mergeClientBookingRequestPages(current, next.page.items),
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

  function requestCard(request: ClientCoachBookingRequestProjection) {
    return (
      <article
        className="client-request-card"
        key={request.id}
        data-request-id={request.id}
        data-slot-id={request.slotId}
      >
        <header>
          <Link href={"/coaches/" + request.coachSlug}>
            <small>Coach</small>
            <strong>{request.coachDisplayName}</strong>
          </Link>
          <span className={"coach-booking-status " + request.status}>
            {clientBookingRequestStatusLabel(request.status)}
          </span>
        </header>
        <p>
          <Clock3 size={16} aria-hidden="true" />
          <strong>{requestTime(request)}</strong>
        </p>
        <p>
          <MapPin size={16} aria-hidden="true" />
          <span>
            {request.location.name}
            <small>{request.location.publicLabel}</small>
          </span>
        </p>
        <p className="client-request-description">
          {clientBookingRequestStatusDescription(request.status)}
        </p>
        {request.status === "pending" && (
          <>
            <small className="client-request-deadline">
              Decision by {requestDeadline(request)}
            </small>
            <button
              type="button"
              className="button secondary"
              disabled={busyKey !== null}
              onClick={() => void withdraw(request.id)}
            >
              <RotateCcw size={15} aria-hidden="true" />
              {busyKey === "withdraw:" + request.id
                ? "Withdrawing…"
                : "Withdraw request"}
            </button>
          </>
        )}
      </article>
    );
  }

  return (
    <section className="client-booking-requests" id="booking-requests">
      <header className="client-request-heading">
        <div>
          <span className="eyebrow">BOOKING REQUESTS</span>
          <h2>Coach confirmation</h2>
          <p>
            Pending requests are saved, but they are not confirmed sessions
            until the coach accepts them.
          </p>
        </div>
        <span className="client-session-count">
          {groups.pending.length} pending
        </span>
      </header>

      {requests.length === 0 ? (
        <div className="client-sessions-state" role="status">
          <CalendarClock size={24} aria-hidden="true" />
          <div>
            <strong>No booking requests yet.</strong>
            <p>Choose an open hour on a coach profile to send one.</p>
            <Link className="text-link" href="/explore">
              Find a coach
            </Link>
          </div>
        </div>
      ) : (
        <div className="client-request-groups">
          {groups.pending.length > 0 && (
            <section aria-labelledby="pending-requests-title">
              <div className="client-session-group-heading">
                <h3 id="pending-requests-title">Awaiting confirmation</h3>
                <span>{groups.pending.length}</span>
              </div>
              <div className="client-request-grid">
                {groups.pending.map(requestCard)}
              </div>
            </section>
          )}
          {groups.history.length > 0 && (
            <section aria-labelledby="request-history-title">
              <div className="client-session-group-heading">
                <h3 id="request-history-title">
                  <History size={17} aria-hidden="true" /> Request history
                </h3>
                <span>{groups.history.length}</span>
              </div>
              <div className="client-request-grid">
                {groups.history.map(requestCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          className="button secondary client-request-load-more"
          disabled={busyKey !== null}
          onClick={() => void loadMore()}
        >
          {busyKey === "page" ? "Loading…" : "Load older requests"}
        </button>
      )}

      {result && (
        <p
          className={
            "client-session-message " +
            (result.status === "saved" ? "success" : "error")
          }
          role={result.status === "saved" ? "status" : "alert"}
          aria-live="polite"
        >
          {result.message}
        </p>
      )}
      {pageMessage && (
        <p className="client-session-message error" role="alert">
          {pageMessage}
        </p>
      )}
    </section>
  );
}
