"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import {
  TypeFirstBooking,
  type PublicBookingTransport,
} from "@/features/session-types/public-booking";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { PublicCoachWebsite } from "@/features/coaches/website/public-coach-website";
import type { ClientCoachBookingRequestProjection } from "@/domain/coach-booking-requests";
import { PrivateScheduleAccess } from "@/features/coaches/private-schedule-access";
import type { CoachMarketplaceActionResult } from "@/app/coach-marketplace-actions";
import type {
  SessionCatalog,
  TypedSessionRequest,
} from "@/domain/typed-sessions";
import { publicScheduleSelection } from "@/domain/public-coach-schedule";
import { privateScheduleSummary } from "@/domain/private-schedule-summary";
import {
  PUBLIC_SCHEDULE_ACTOR,
  PUBLIC_SCHEDULE_COACH,
  PUBLIC_SCHEDULE_IDENTITY,
  PUBLIC_SCHEDULE_NOW,
  PUBLIC_SCHEDULE_SLOTS,
  PUBLIC_SCHEDULE_SUBJECT,
  publicFixtureRequest,
} from "./public-schedule-data";
import "@/features/coaches/website/public-coach-website.css";

const type60 = "b0399000-0000-4000-8000-000000000060";
const type90 = "b0399000-0000-4000-8000-000000000090";
const firstVenue = "b0399000-0000-4000-8000-000000000001";
const secondVenue = "b0399000-0000-4000-8000-000000000002";
const catalog: SessionCatalog = {
  enabled: true,
  types: [60, 90].map((minutes) => ({
    id: minutes === 60 ? type60 : type90,
    format: "private",
    name: minutes === 60 ? "Boxing foundations" : "Technique deep dive",
    description: "Disposable interface fixture. No real booking or account.",
    durationMinutes: minutes as 60 | 90,
    color: "#61417b",
    defaultLocationId: null,
    bookable: true,
    archived: false,
    revision: 1,
  })),
  locations: [
    {
      id: firstVenue,
      name: "Chimosa · fixture",
      label: "Example Berlin training place",
    },
    {
      id: secondVenue,
      name: "Outdoor training · fixture",
      label: "Example outdoor Berlin training place",
    },
  ],
};
const requestId = "e0399000-0000-4000-8000-000000000001";
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function SevenDayBookingHarness({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const [perspective, setPerspective] = useState(
    params.fixtureGuest === "1" ? "guest" : "athlete",
  );
  const [mode, setMode] = useState("typed");
  const [catalogRevision, setCatalogRevision] = useState(1);
  const liveCatalog = useMemo(
    () => ({
      ...catalog,
      types: catalog.types.map((type) => ({
        ...type,
        revision: catalogRevision,
      })),
    }),
    [catalogRevision],
  );
  const [legacyPending, setLegacyPending] = useState<
    readonly ClientCoachBookingRequestProjection[]
  >(() => [
    {
      ...publicFixtureRequest(
        PUBLIC_SCHEDULE_SLOTS.find(
          (slot) => slot.startsAt === "2026-10-22T12:00:00.000Z",
        )!,
      ),
      id: "e0399000-0000-4000-8000-000000000022",
    },
  ]);
  const [readMode, setReadMode] = useState("available");
  const [closed, setClosed] = useState<readonly string[]>([]);
  const [requestMode, setRequestMode] = useState("saved");
  const readSetting = useRef("available"),
    requestSetting = useRef("saved");
  const typedClosed = useRef(new Set<string>());
  const [commands, setCommands] = useState<readonly TypedSessionRequest[]>([]);
  const [legacyIds, setLegacyIds] = useState<readonly string[]>([]);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const transport = useMemo<PublicBookingTransport>(
    () => ({
      async week(input, signal) {
        const scenario = readSetting.current;
        // Deliberately ignore abort in this fixture so late results exercise the
        // component's independent response fence, not just AbortController.
        void signal;
        await delay(scenario === "slow" && input.typeId === type90 ? 900 : 25);
        if (scenario === "error" || scenario === "retry") {
          if (scenario === "retry") readSetting.current = "available";
          return { status: "unavailable" };
        }
        const selection = publicScheduleSelection(
          input.weekOf,
          PUBLIC_SCHEDULE_NOW,
        );
        const minutes = input.typeId === type90 ? 90 : 60;
        const days = selection.dates.map((date, index) => ({
          date,
          times:
            scenario === "empty" || index === 2
              ? []
              : Array.from({ length: minutes === 90 ? 1 : 3 }, (_, i) => {
                  const start = new Date(
                    `${date}T${String(9 + i * 3 + (input.locationId === secondVenue ? 1 : 0)).padStart(2, "0")}:00:00Z`,
                  );
                  return {
                    startsAt: start.toISOString(),
                    endsAt: new Date(
                      start.getTime() + minutes * 60000,
                    ).toISOString(),
                  };
                }).filter(
                  (time) =>
                    !typedClosed.current.has(
                      `${input.typeId}:${input.locationId}:${time.startsAt}`,
                    ),
                ),
        }));
        if (scenario === "malformed")
          return {
            status: "ready",
            week: {
              referenceTime: PUBLIC_SCHEDULE_NOW,
              resetToCurrent: false,
              days: days.slice(1),
            },
          };
        return {
          status: "ready",
          week: {
            referenceTime: PUBLIC_SCHEDULE_NOW,
            resetToCurrent: !selection.inHorizon,
            days,
          },
        };
      },
      async request(command) {
        setCommands((old) => [...old, command]);
        const outcome = requestSetting.current;
        await delay(outcome === "slow" ? 650 : 30);
        if (outcome === "conflict")
          typedClosed.current.add(
            `${command.typeId}:${command.locationId}:${command.startsAt}`,
          );
        return outcome === "unknown"
          ? { status: "unavailable" }
          : outcome === "conflict"
            ? { status: "conflict" }
            : {
                status: "saved",
                requestId,
                requestStatus: "pending",
                bookingId: null,
              };
      },
    }),
    [],
  );
  const actions = {
    async request(slotId: string): Promise<CoachMarketplaceActionResult> {
      setLegacyIds((old) => [...old, slotId]);
      const slot = PUBLIC_SCHEDULE_SLOTS.find((slot) => slot.id === slotId);
      if (!slot || requestSetting.current === "conflict") {
        setClosed((old) => [...old, slotId]);
        return {
          status: "conflict",
          message: "That hour is no longer available.",
        };
      }
      if (requestSetting.current === "unknown")
        return {
          status: "unavailable",
          message:
            "Result unknown. Retry the original time or check My sessions.",
        };
      const request = {
        ...publicFixtureRequest(slot),
        id: `e0399000-0000-4000-8000-${slot.id.slice(-12)}`,
      };
      setLegacyPending((old) => [
        ...old.filter((item) => item.id !== request.id),
        request,
      ]);
      return { status: "saved", message: "Request saved.", request };
    },
    async withdraw(requestId: string): Promise<CoachMarketplaceActionResult> {
      setLegacyPending((old) => old.filter((item) => item.id !== requestId));
      return {
        status: "saved",
        message: "Request withdrawn.",
        requestId,
        requestStatus: "withdrawn",
      };
    },
    async cancel(): Promise<CoachMarketplaceActionResult> {
      return { status: "saved", message: "Fixture cancellation." };
    },
  };
  const signedOut = perspective === "guest";
  const session = signedOut
    ? { status: "signed-out" as const }
    : perspective === "unverified"
      ? { status: "unavailable" as const }
      : {
          status: "signed-in" as const,
          subject:
            perspective === "changed"
              ? "changed-subject"
              : PUBLIC_SCHEDULE_SUBJECT,
          email: "fixture@users.movx.test",
          expiresAt: null,
        };
  const actor = signedOut
    ? { status: "signed-out" as const }
    : PUBLIC_SCHEDULE_ACTOR;
  const slots = PUBLIC_SCHEDULE_SLOTS.filter(
    (slot) => !closed.includes(slot.id),
  );
  const summary = privateScheduleSummary(
    publicScheduleSelection(undefined, PUBLIC_SCHEDULE_NOW).dates.map(
      (date, index) => ({ date, count: index === 2 ? 0 : 6 }),
    ),
  );
  return (
    <>
      <aside
        aria-label="Disposable booking fixture controls"
        style={{
          padding: 16,
          border: "1px dashed #a791b9",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          background: "#f3edf9",
        }}
      >
        <strong style={{ flexBasis: "100%" }}>
          DEV0399 · Interface fixtures only · No real accounts, APIs or requests
        </strong>
        <span data-testid="fixture-ready">
          {hydrated ? "Ready" : "Loading"}
        </span>
        <button
          type="button"
          className="button secondary"
          onClick={() => setCatalogRevision((value) => value + 1)}
        >
          Revise class details
        </button>
        <div role="group" aria-label="Booking path">
          {["typed", "legacy"].map((value) => (
            <button
              className="button secondary"
              type="button"
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === "typed" ? "Class booking" : "Legacy booking"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Account perspective">
          {["athlete", "guest", "changed", "unverified", "owner"].map(
            (value) => (
              <button
                className="button secondary"
                type="button"
                key={value}
                aria-pressed={perspective === value}
                onClick={() => setPerspective(value)}
              >
                {value === "athlete"
                  ? "Athlete"
                  : value === "guest"
                    ? "Guest"
                    : value === "changed"
                      ? "Changed account"
                      : value === "owner"
                        ? "Coach owner"
                        : "Unverified account"}
              </button>
            ),
          )}
        </div>
        <label>
          Availability
          <select
            aria-label="Fixture availability"
            value={readMode}
            onChange={(event) => {
              readSetting.current = event.target.value;
              setReadMode(event.target.value);
            }}
          >
            {["available", "empty", "error", "retry", "malformed", "slow"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Request result
          <select
            aria-label="Fixture request result"
            value={requestMode}
            onChange={(event) => {
              requestSetting.current = event.target.value;
              setRequestMode(event.target.value);
            }}
          >
            {["saved", "unknown", "conflict", "slow"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <pre
          data-testid="typed-commands"
          style={{
            fontSize: 10,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
            flexBasis: "100%",
          }}
        >
          {JSON.stringify(commands)}
        </pre>
        <pre
          data-testid="legacy-commands"
          style={{
            fontSize: 10,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
            flexBasis: "100%",
          }}
        >
          {JSON.stringify(legacyIds)}
        </pre>
      </aside>
      <main style={{ maxWidth: 1280, margin: "auto", padding: "25px 16px" }}>
        <h1>DEV0399 Coach · example booking</h1>
        <AuthSessionProvider key={perspective} initialSession={session}>
          <ActorProvider initialActor={actor}>
            <PublicCoachWebsite
              state={{
                status: "ready",
                coach: {
                  ...PUBLIC_SCHEDULE_COACH,
                  displayName: "DEV0399 Coach",
                  slug: "schedule-coach",
                  locations: [],
                  portraitUrl: null,
                },
                slots: [],
              }}
              catalog={liveCatalog}
              ownProfile={perspective === "owner"}
              marketplace={
                <PrivateScheduleAccess
                  expected={{
                    subject: PUBLIC_SCHEDULE_SUBJECT,
                    actorIdentity: PUBLIC_SCHEDULE_IDENTITY,
                  }}
                  summary={summary}
                  returnTo="/coaches/schedule-coach#private-schedule"
                >
                  {mode === "typed" ? (
                    <section id="private-schedule" tabIndex={-1}>
                      <TypeFirstBooking
                        key={readMode}
                        catalog={liveCatalog}
                        slug="schedule-coach"
                        ownProfile={perspective === "owner"}
                        referenceTime={PUBLIC_SCHEDULE_NOW}
                        returnTo="/coaches/schedule-coach"
                        selectedDate={params.date}
                        transport={transport}
                      />
                    </section>
                  ) : (
                    <CoachMarketplace
                      key={String(params.date ?? "today")}
                      coachProfileId={PUBLIC_SCHEDULE_COACH.profileId}
                      coachDisplayName={PUBLIC_SCHEDULE_COACH.displayName}
                      coachSlug="schedule-coach"
                      slots={slots}
                      actor={{
                        status: "authorized",
                        actorProfileId:
                          perspective === "owner"
                            ? PUBLIC_SCHEDULE_COACH.profileId
                            : "b0255000-0000-4000-8000-000000000001",
                        subject: PUBLIC_SCHEDULE_SUBJECT,
                        actorIdentity: PUBLIC_SCHEDULE_IDENTITY,
                        bookings: [],
                        pendingRequests: legacyPending,
                      }}
                      referenceTime={PUBLIC_SCHEDULE_NOW}
                      selectedDate={params.date}
                      actions={actions}
                    />
                  )}
                </PrivateScheduleAccess>
              }
            />
          </ActorProvider>
        </AuthSessionProvider>
      </main>
    </>
  );
}
