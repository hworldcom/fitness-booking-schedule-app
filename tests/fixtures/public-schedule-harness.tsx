"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import type { CoachMarketplaceActionResult } from "@/app/coach-marketplace-actions";
import {
  PUBLIC_SCHEDULE_ACTOR,
  PUBLIC_SCHEDULE_COACH,
  PUBLIC_SCHEDULE_IDENTITY,
  PUBLIC_SCHEDULE_NOW,
  PUBLIC_SCHEDULE_SLOTS,
  PUBLIC_SCHEDULE_SUBJECT,
  publicFixtureRequest,
} from "./public-schedule-data";

export function PublicScheduleHarness({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const [mode, setMode] = useState("guest");
  const response = useRef("saved");
  const [closed, setClosed] = useState<readonly string[]>([]);
  const [actionLog, setActionLog] = useState("");
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const session =
    mode === "guest"
      ? { status: "signed-out" as const }
      : {
          status: "signed-in" as const,
          subject:
            mode === "changed" ? "other-subject" : PUBLIC_SCHEDULE_SUBJECT,
          email: "fixture@users.movx.test",
          expiresAt: null,
        };
  const actor =
    mode === "guest"
      ? { status: "signed-out" as const }
      : PUBLIC_SCHEDULE_ACTOR;
  const marketplaceActor =
    mode === "guest"
      ? { status: "signed-out" as const }
      : mode === "unavailable"
        ? { status: "unavailable" as const }
        : {
            status: "authorized" as const,
            actorProfileId: "b0255000-0000-4000-8000-000000000001",
            subject: PUBLIC_SCHEDULE_SUBJECT,
            actorIdentity: PUBLIC_SCHEDULE_IDENTITY,
            bookings: [],
            pendingRequests: [],
          };
  const slots = PUBLIC_SCHEDULE_SLOTS.filter(
    (slot) => !closed.includes(slot.id),
  );
  const actions = {
    request: async (slotId: string): Promise<CoachMarketplaceActionResult> => {
      setActionLog(slotId);
      const slot = slots.find((slot) => slot.id === slotId);
      if (!slot || response.current === "conflict") {
        setClosed((current) => [...current, slotId]);
        return {
          status: "conflict",
          message:
            "That hour is no longer available. Refresh to see the latest schedule.",
        };
      }
      if (response.current === "unavailable")
        return {
          status: "unavailable",
          message: "MovX could not verify the schedule. Nothing was changed.",
        };
      return {
        status: "saved",
        message: "Request saved.",
        request: publicFixtureRequest(slot),
      };
    },
    withdraw: async (): Promise<CoachMarketplaceActionResult> => ({
      status: "saved",
      message: "Request withdrawn.",
      requestId: "e0255000-0000-4000-8000-000000000001",
      requestStatus: "withdrawn",
    }),
    cancel: async (): Promise<CoachMarketplaceActionResult> => ({
      status: "saved",
      message: "Fixture cancellation",
    }),
  };
  return (
    <>
      <aside
        aria-label="Public schedule fixture controls"
        style={{
          padding: 12,
          border: "1px dashed #9b9",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <strong>
          Isolated public schedule fixture — no database or real requests
        </strong>
        <span data-testid="fixture-ready">
          {hydrated ? "Ready" : "Loading"}
        </span>
        <label>
          Browse as{" "}
          <select
            aria-label="Browse as"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="guest">Guest</option>
            <option value="athlete">Athlete</option>
            <option value="changed">Changed account</option>
            <option value="unavailable">Unverified account</option>
          </select>
        </label>
        <label>
          Request response{" "}
          <select
            aria-label="Request response"
            onChange={(e) => {
              response.current = e.target.value;
            }}
          >
            <option value="saved">Save request</option>
            <option value="conflict">Time closed</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <span data-testid="fixture-action">{actionLog}</span>
      </aside>
      <AuthSessionProvider key={mode} initialSession={session}>
        <ActorProvider initialActor={actor}>
          {params.unavailable === "1" ? (
            <CoachProfileUnavailable />
          ) : (
            <CoachProfileView
              state={{ status: "ready", coach: PUBLIC_SCHEDULE_COACH, slots }}
              marketplace={
                <CoachMarketplace
                  key={String(params.date ?? "today")}
                  coachProfileId={PUBLIC_SCHEDULE_COACH.profileId}
                  coachDisplayName={PUBLIC_SCHEDULE_COACH.displayName}
                  coachSlug={PUBLIC_SCHEDULE_COACH.slug}
                  slots={slots}
                  actor={marketplaceActor}
                  referenceTime={PUBLIC_SCHEDULE_NOW}
                  selectedDate={params.date}
                  actions={actions}
                />
              }
            />
          )}
        </ActorProvider>
      </AuthSessionProvider>
    </>
  );
}
