"use client";

import { useRef } from "react";
import type {
  BookingConnectionContext,
  ConnectionDecision,
  ConnectionRole,
} from "@/domain/coach-athlete-connections";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import { ConnectionDisconnectControl } from "./connection-disconnect-control";
import { connectionStatusLabel } from "./connection-model";

export function BookingConnectionOptions({
  role = "coach",
  booking,
  context,
  error,
  busy,
  mayInitiate,
  onLoad,
  onMutation,
}: {
  role?: ConnectionRole;
  booking: PrivateBookingProjection;
  context: BookingConnectionContext | null | undefined;
  error: string | null;
  busy: boolean;
  mayInitiate: boolean;
  onLoad: () => void;
  onMutation: (form: FormData) => void;
}) {
  const operation = useRef<{ key: string; id: string } | null>(null);
  function send() {
    const key = `${booking.id}:${context?.connection?.id ?? "none"}`;
    if (operation.current?.key !== key)
      operation.current = { key, id: crypto.randomUUID() };
    const form = new FormData();
    form.set("intent", "send");
    form.set("bookingId", booking.id);
    form.set("operationId", operation.current.id);
    if (context?.connection) form.set("previousId", context.connection.id);
    onMutation(form);
  }
  function decide(intent: ConnectionDecision) {
    if (!context?.connection) return;
    const form = new FormData();
    form.set("intent", intent);
    form.set("connectionId", context.connection.id);
    onMutation(form);
  }
  const connection = context?.connection;
  const name =
    role === "coach" ? booking.clientDisplayName : booking.coachDisplayName;
  const list = role === "coach" ? "My athletes" : "My coaches";
  const target = role === "coach" ? "my-athletes" : "my-coaches";
  return (
    <div
      className="coach-booking-connection"
      aria-label={`Connection with ${name}`}
    >
      {context === undefined || context === null ? (
        <>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onLoad}
          >
            {busy
              ? "Checking connection…"
              : context === null
                ? "Retry connection options"
                : "Connection options"}
          </button>
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <>
          <p>
            {connection
              ? connectionStatusLabel(connection.status)
              : "Not connected"}
            .
            {connection?.status === "pending" &&
              (connection.recipientProfileId ===
              (role === "coach"
                ? connection.coachProfileId
                : connection.athleteProfileId)
                ? ` This ${role === "coach" ? "athlete" : "coach"} is waiting for your decision.`
                : ` The ${role === "coach" ? "athlete" : "coach"} must accept your request.`)}
          </p>
          <div className="coach-connection-actions">
            {mayInitiate && context.canSend && (
              <button
                type="button"
                className="button dark"
                disabled={busy}
                onClick={send}
              >
                {connection
                  ? "Request reconnection"
                  : "Send connection request"}
              </button>
            )}
            {mayInitiate && connection?.canAccept && (
              <button
                type="button"
                className="button dark"
                disabled={busy}
                onClick={() => decide("accept")}
              >
                Accept connection
              </button>
            )}
            {connection?.canDecline && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => decide("decline")}
              >
                Decline connection
              </button>
            )}
            {connection?.canWithdraw && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => decide("withdraw")}
              >
                Withdraw request
              </button>
            )}
            {connection?.canDisconnect && (
              <>
                <a href={`#${target}`} className="button secondary">
                  View {list}
                </a>
                <ConnectionDisconnectControl
                  name={name}
                  disabled={busy}
                  onDisconnect={() => decide("disconnect")}
                />
              </>
            )}
            <button
              type="button"
              className="coach-connection-text-button"
              disabled={busy}
              onClick={onLoad}
            >
              Refresh connection status
            </button>
          </div>
          {!context.canSend && !connection && (
            <p>
              A confirmed or completed shared session is required to connect.
            </p>
          )}
          {connection?.status === "pending" &&
            !connection.canAccept &&
            !connection.canWithdraw && (
              <p>This request currently cannot be accepted.</p>
            )}
        </>
      )}
    </div>
  );
}
