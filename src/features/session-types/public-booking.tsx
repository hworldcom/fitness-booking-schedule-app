"use client";
import { SessionActorBoundary } from "./actor-boundary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { signInHref } from "@/auth/return-to";
import { coachRedirectHref } from "@/domain/coach-public-url";
import { calendarDate } from "@/domain/coach-calendar";
import { publicScheduleSelection } from "@/domain/public-coach-schedule";
import { parseSessionWeek, type SessionWeek } from "@/domain/session-week";
import { sessionUuid } from "@/domain/session-types";
import type {
  SessionCatalog,
  SessionTime,
  TypedSessionRequest,
} from "@/domain/typed-sessions";
import { SevenDaySchedule } from "@/features/coaches/seven-day-schedule";
import {
  publicScheduleDateLabel,
  publicScheduleTimeRange,
} from "@/features/coaches/public-schedule-model";
import { SessionRequestReview } from "@/features/coaches/session-request-review";
import "./session-types.css";

export type PublicBookingTransport = Readonly<{
  week: (
    input: { slug: string; typeId: string; locationId: string; weekOf: string },
    signal: AbortSignal,
  ) => Promise<unknown>;
  request: (command: TypedSessionRequest) => Promise<unknown>;
}>;
const liveTransport: PublicBookingTransport = {
  async week({ slug, ...query }, signal) {
    const response = await fetch(
      `/api/coaches/${slug}/session-types?${new URLSearchParams(query)}`,
      { cache: "no-store", signal },
    );
    return response.json();
  },
  async request(command) {
    const response = await fetch("/api/session-bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    return response.json();
  },
};
type BookingProps = {
  catalog: SessionCatalog;
  slug: string;
  ownProfile: boolean;
  referenceTime: string;
  returnTo: string;
  selectedDate?: string | string[];
  transport?: PublicBookingTransport;
};
export function TypeFirstBooking(props: BookingProps) {
  return (
    <SessionActorBoundary>
      {(identity) => (
        <BookingForm
          key={`${identity}:${props.slug}:${JSON.stringify({ types: props.catalog.types.filter((type) => type.format === "private"), locations: props.catalog.locations })}`}
          {...props}
        />
      )}
    </SessionActorBoundary>
  );
}
function BookingForm({
  catalog,
  slug,
  ownProfile,
  referenceTime,
  returnTo,
  selectedDate,
  transport = liveTransport,
}: BookingProps) {
  const router = useRouter();
  const { actor } = useActor();
  const { session } = useAuthSession();
  const types = catalog.types.filter(
    (type) => type.format === "private" && type.bookable && !type.archived,
  );
  const firstType =
    types.find(
      (type) =>
        !type.defaultLocationId ||
        catalog.locations.some(
          (location) => location.id === type.defaultLocationId,
        ),
    ) ?? types[0];
  const initialLocation = firstType?.defaultLocationId
    ? (catalog.locations.find(
        (location) => location.id === firstType.defaultLocationId,
      )?.id ?? "")
    : (catalog.locations[0]?.id ?? "");
  const [typeId, setTypeId] = useState(firstType?.id ?? "");
  const [locationId, setLocationId] = useState(initialLocation);
  const type = types.find((item) => item.id === typeId);
  const [clock, setClock] = useState(referenceTime);
  const [weekDate, setWeekDate] = useState(
    publicScheduleSelection(selectedDate, referenceTime).dates[0],
  );
  const [observedDate, setObservedDate] = useState(selectedDate);
  const [attempt, setAttempt] = useState(0);
  const key = `${slug}:${typeId}:${locationId}:${weekDate}:${attempt}`;
  const [loaded, setLoaded] = useState<
    | { key: string; status: "ready"; week: SessionWeek }
    | { key: string; status: "unavailable" }
    | null
  >(null);
  const [selectionState, setSelectionState] = useState<{
    key: string;
    time: SessionTime;
  } | null>(null);
  const selected = selectionState?.key === key ? selectionState.time : null;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<TypedSessionRequest | null>(null);
  const [dateNotice, setDateNotice] = useState(() => {
    const initial = publicScheduleSelection(selectedDate, referenceTime);
    return initial.invalid
      ? "That date is invalid. Showing this week."
      : !initial.inHorizon
        ? "That date is outside the current schedule. Showing this week."
        : "";
  });
  const generation = useRef(0);
  const inFlight = useRef(false);
  const success = useRef<HTMLDivElement>(null);
  const selection = publicScheduleSelection(weekDate, clock);
  const current = loaded?.key === key ? loaded : null;
  const status =
    !type || !locationId ? "unselected" : (current?.status ?? "loading");
  const times =
    current?.status === "ready"
      ? current.week.days.flatMap((day) => day.times)
      : [];
  const locked = sending || pending !== null;
  const own = actor.status === "authorized" && ownProfile;
  const signedIn =
    actor.status === "authorized" && session.status === "signed-in";

  // A server refresh may acknowledge the date already pushed into history.
  // Preserve this week's filters/notices in that case; a different return
  // context clears the old choice before it can be rendered or submitted.
  if (observedDate !== selectedDate) {
    setObservedDate(selectedDate);
    const next = publicScheduleSelection(selectedDate, clock);
    if (next.dates[0] !== weekDate || selectedDate !== weekDate) {
      setWeekDate(next.dates[0]);
      setSelectionState(null);
      setPending(null);
      setSent(false);
      setMessage("");
      setReviewOpen(false);
      setDateNotice(
        next.invalid
          ? "That date is invalid. Showing this week."
          : !next.inHorizon
            ? "That date is outside the current schedule. Showing this week."
            : "",
      );
    }
  }

  function clear() {
    generation.current++;
    setSelectionState(null);
    setMessage("");
    setPending(null);
    setSent(false);
    setReviewOpen(false);
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [key],
  );
  useEffect(() => {
    if (!typeId || !locationId) return;
    const controller = new AbortController();
    let active = true;
    // The transport may ignore abort or never settle. Fence it independently so
    // a deadline cannot later become a stale success (including after Retry).
    const deadline = window.setTimeout(() => {
      active = false;
      controller.abort();
      setLoaded({ key, status: "unavailable" });
    }, 15_000);
    transport
      .week({ slug, typeId, locationId, weekOf: weekDate }, controller.signal)
      .then((value) => {
        if (!active) return;
        const result = value as { status?: string; week?: unknown } | null;
        if (result?.status !== "ready")
          throw new Error("Availability unavailable.");
        const week = parseSessionWeek(
          result.week,
          weekDate,
          type?.durationMinutes,
        );
        setLoaded({ key, status: "ready", week });
        setClock(week.referenceTime);
        if (week.resetToCurrent) {
          setWeekDate(week.days[0].date);
          setDateNotice(
            "The schedule window has moved. Showing the current week.",
          );
        }
      })
      .catch(() => {
        if (active) setLoaded({ key, status: "unavailable" });
      })
      .finally(() => window.clearTimeout(deadline));
    return () => {
      active = false;
      window.clearTimeout(deadline);
      controller.abort();
    };
  }, [
    key,
    slug,
    typeId,
    locationId,
    weekDate,
    type?.durationMinutes,
    transport,
  ]);
  useEffect(() => {
    if (sent) success.current?.focus();
  }, [sent]);
  useEffect(() => {
    const pop = () => {
      const values = new URL(window.location.href).searchParams.getAll("date");
      const context = publicScheduleSelection(
        values.length > 1 ? values : values[0],
        clock,
      );
      if (context.dates[0] !== weekDate) {
        generation.current++;
        setWeekDate(context.dates[0]);
        setSelectionState(null);
        setMessage("");
        setPending(null);
        setSent(false);
        setReviewOpen(false);
        setDateNotice(
          context.invalid
            ? "That date is invalid. Showing this week."
            : !context.inHorizon
              ? "That date is outside the current schedule. Showing this week."
              : "",
        );
      }
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [clock, weekDate]);
  function navigate(date: string) {
    if (locked) return;
    clear();
    setWeekDate(date);
    setDateNotice("");
    window.history.pushState(
      null,
      "",
      coachRedirectHref(returnTo, { date, section: "private-schedule" }),
    );
  }
  async function request() {
    if (!type || !selected || !signedIn || own || inFlight.current || sent)
      return;
    const command = pending ?? {
      commandId: crypto.randomUUID(),
      typeId: type.id,
      typeRevision: type.revision,
      locationId,
      startsAt: selected.startsAt,
    };
    const view = generation.current;
    inFlight.current = true;
    setPending(command);
    setSending(true);
    setMessage("");
    try {
      const value = await transport.request(command);
      if (view !== generation.current) return;
      const result = value as {
        status?: string;
        requestId?: string;
        requestStatus?: string;
      } | null;
      if (
        result?.status === "saved" &&
        sessionUuid(result.requestId) &&
        typeof result.requestStatus === "string"
      ) {
        setSent(true);
        setPending(null);
        setReviewOpen(false);
        setMessage(
          "Request sent. Check My training for the coach’s confirmation.",
        );
      } else if (result?.status === "conflict") {
        setPending(null);
        setSelectionState(null);
        setReviewOpen(false);
        setAttempt((value) => value + 1);
        setMessage(
          "This time or class has changed. Choose a current time from the refreshed week.",
        );
        router.refresh();
      } else if (
        ["signed-out", "forbidden", "invalid"].includes(result?.status ?? "")
      ) {
        setPending(null);
        setSelectionState(null);
        setReviewOpen(false);
        setMessage(
          result?.status === "signed-out"
            ? "Sign in before requesting this class."
            : "This class is not available for this account or its details have changed. Reload before trying again.",
        );
        router.refresh();
      } else {
        setReviewOpen(false);
        setMessage(
          "We couldn’t verify the request. Retry the same request or check My training before choosing another time.",
        );
      }
    } catch {
      if (view === generation.current) {
        setReviewOpen(false);
        setMessage(
          "We couldn’t verify the request. Retry the same request or check My training before choosing another time.",
        );
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  const details =
    selected && type ? (
      <>
        <p>
          <strong>{type.name}</strong> · {type.durationMinutes} minutes
        </p>
        <p>
          {publicScheduleDateLabel(calendarDate(selected.startsAt))}
          <br />
          {publicScheduleTimeRange(selected.startsAt, selected.endsAt)} · Berlin
          time
        </p>
        <p>
          {
            catalog.locations.find((location) => location.id === locationId)
              ?.name
          }
          <br />
          {
            catalog.locations.find((location) => location.id === locationId)
              ?.label
          }
        </p>
      </>
    ) : null;
  return (
    <section
      className="typed-public-booking coach-week-booking"
      aria-label="Private session booking"
    >
      <SevenDaySchedule
        selection={selection}
        items={times.map((time) => ({ ...time, id: time.startsAt }))}
        status={status}
        unselectedCopy={
          types.length
            ? "No available training place is configured for this class."
            : "This coach isn’t offering private classes right now."
        }
        selectedId={selected?.startsAt}
        duration={type?.durationMinutes}
        disabled={locked || sent}
        onNavigate={navigate}
        onRetry={() => {
          clear();
          setAttempt((value) => value + 1);
          router.refresh();
        }}
        onSelect={(id) => {
          const time = times.find((time) => time.startsAt === id);
          if (time && !locked && !sent) {
            setSelectionState({ key, time });
            setMessage("");
          }
        }}
      >
        {types.length ? (
          <div className="seven-day-filters">
            <label>
              Class
              <select
                aria-label="Session type"
                disabled={locked}
                value={typeId}
                onChange={(event) => {
                  clear();
                  setTypeId(event.target.value);
                  const next = types.find(
                    (item) => item.id === event.target.value,
                  );
                  setLocationId(
                    next?.defaultLocationId
                      ? (catalog.locations.find(
                          (item) => item.id === next.defaultLocationId,
                        )?.id ?? "")
                      : catalog.locations.some((item) => item.id === locationId)
                        ? locationId
                        : (catalog.locations[0]?.id ?? ""),
                  );
                }}
              >
                {types.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>
            <label>
              Training place
              <select
                aria-label="Venue"
                disabled={locked || !!type?.defaultLocationId}
                value={locationId}
                onChange={(event) => {
                  clear();
                  setLocationId(event.target.value);
                }}
              >
                {!locationId && (
                  <option value="">No available training place</option>
                )}
                {catalog.locations
                  .filter(
                    (location) =>
                      !type?.defaultLocationId ||
                      type.defaultLocationId === location.id,
                  )
                  .map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.name}
                    </option>
                  ))}
              </select>
            </label>
            {type?.description && <p>{type.description}</p>}
          </div>
        ) : (
          <p role="status">
            This coach isn’t offering private classes right now.
          </p>
        )}
      </SevenDaySchedule>
      {dateNotice && (
        <p role="status" className="seven-day-notice">
          {dateNotice}
        </p>
      )}
      {sent ? (
        <div
          className="seven-day-confirmation"
          ref={success}
          tabIndex={-1}
          role="status"
        >
          <h3>Request sent · awaiting coach confirmation</h3>
          {details}
          <p>Your session is not confirmed yet.</p>
          <Link className="button dark" href="/sessions#booking-requests">
            View My training
          </Link>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              clear();
              setAttempt((value) => value + 1);
            }}
          >
            Choose another time
          </button>
        </div>
      ) : (
        <div className="seven-day-review-bar" aria-live="polite">
          <div>
            <h3>
              {selected
                ? `${publicScheduleDateLabel(calendarDate(selected.startsAt), true)} · ${publicScheduleTimeRange(selected.startsAt, selected.endsAt)}`
                : "Find your time above"}
            </h3>
            <p>
              {selected && type
                ? `${type.name} · ${type.durationMinutes} min · ${catalog.locations.find((location) => location.id === locationId)?.name}`
                : "You’ll review the details before sending a request."}
            </p>
            {own && (
              <p>
                This is your coaching profile. Schedule a client from your
                workspace.
              </p>
            )}
          </div>
          {pending ? (
            <button
              type="button"
              className="button dark"
              disabled={sending}
              onClick={() => void request()}
            >
              {sending ? "Sending…" : "Retry the same request"}
            </button>
          ) : signedIn ? (
            <button
              type="button"
              className="button dark"
              disabled={!selected || own || status !== "ready"}
              onClick={() => setReviewOpen(true)}
            >
              Review request →
            </button>
          ) : (
            <Link
              className="button dark"
              href={signInHref(
                coachRedirectHref(returnTo, {
                  date: weekDate,
                  section: "private-schedule",
                }),
              )}
            >
              Sign in to request
            </Link>
          )}
        </div>
      )}
      {message && (
        <p className="seven-day-notice" role="status">
          {message}{" "}
          {!sent && (
            <Link href="/sessions#booking-requests">Check My training</Link>
          )}
        </p>
      )}
      <SessionRequestReview
        open={reviewOpen && !!selected}
        onClose={() => setReviewOpen(false)}
        onSubmit={() => void request()}
        busy={sending}
      >
        {details}
      </SessionRequestReview>
      {catalog.types.some((item) => item.format === "group") && (
        <section className="session-type-editor">
          <h3>Group classes</h3>
          {catalog.types
            .filter((item) => item.format === "group")
            .map((item) => (
              <p key={item.id}>
                <Link href={`/events?sessionType=${item.id}`}>
                  {item.name} · {item.durationMinutes} min →
                </Link>
              </p>
            ))}
        </section>
      )}
    </section>
  );
}
