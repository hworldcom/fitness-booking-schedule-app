"use client";
import { SessionActorBoundary } from "./actor-boundary";
import Link from "next/link";
import { useState } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { signInHref } from "@/auth/return-to";
import type {
  SessionCatalog,
  SessionTime,
  TypedSessionRequest,
} from "@/domain/typed-sessions";
import "./session-types.css";
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function TypeFirstBooking({
  catalog,
  slug,
  ownProfile,
  referenceTime,
  returnTo,
}: {
  catalog: SessionCatalog;
  slug: string;
  ownProfile: boolean;
  referenceTime: string;
  returnTo: string;
}) {
  return (
    <SessionActorBoundary publicWhenSignedOut>
      {(identity) => (
        <BookingForm
          key={`${identity}:${slug}`}
          catalog={catalog}
          slug={slug}
          ownProfile={ownProfile}
          referenceTime={referenceTime}
          returnTo={returnTo}
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
}: {
  catalog: SessionCatalog;
  slug: string;
  ownProfile: boolean;
  referenceTime: string;
  returnTo: string;
}) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const types = catalog.types.filter((t) => t.format === "private");
  const [typeId, setTypeId] = useState("");
  const type = types.find((t) => t.id === typeId);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<readonly SessionTime[] | null>(null);
  const [selected, setSelected] = useState<SessionTime | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<TypedSessionRequest | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(referenceTime));
  const maxDate = new Date(`${today}T12:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + 29);
  const max = maxDate.toISOString().slice(0, 10);
  function clear() {
    setTimes(null);
    setSelected(null);
    setMessage("");
    setPending(null);
    setSent(false);
  }
  async function load() {
    if (!type) return;
    setBusy(true);
    setMessage("");
    setSelected(null);
    setPending(null);
    setSent(false);
    try {
      const q = new URLSearchParams({ typeId: type.id, locationId, date });
      const response = await fetch(`/api/coaches/${slug}/session-types?${q}`, {
        cache: "no-store",
      });
      const r = await response.json();
      if (r.status === "ready") {
        setTimes(r.times);
        if (!r.times.length)
          setMessage(
            "No times fit this class on that date. Try another date or venue.",
          );
      } else {
        setTimes(null);
        setMessage("Available times couldn’t be verified. Please try again.");
      }
    } catch {
      setTimes(null);
      setMessage("Available times couldn’t be verified. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function request() {
    if (!type || !selected) return;
    const command = pending ?? {
      commandId: crypto.randomUUID(),
      typeId: type.id,
      typeRevision: type.revision,
      locationId,
      startsAt: selected.startsAt,
    };
    setPending(command);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/session-bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const r = await response.json();
      if (r.status === "saved") {
        setSent(true);
        setPending(null);
        setMessage(
          "Request sent. Your session is pending until the coach confirms.",
        );
      } else {
        if (r.status !== "unavailable") setPending(null);
        setMessage(
          r.status === "conflict"
            ? "This time or class has changed. Reload the page and choose a current time."
            : r.status === "signed-out"
              ? "Sign in before requesting this class."
              : r.status === "forbidden"
                ? "This class is not available to this account."
                : "We couldn’t verify the request. Retry the same request or check My sessions.",
        );
      }
    } catch {
      setMessage(
        "We couldn’t verify the request. Retry the same request or check My sessions.",
      );
    } finally {
      setBusy(false);
    }
  }
  const own = actor.status === "authorized" && ownProfile;
  const signedIn =
    actor.status === "authorized" && session.status === "signed-in";
  return (
    <section className="typed-public-booking" aria-labelledby="choose-class">
      <h2 id="choose-class">Choose your class</h2>
      {types.length === 0 ? (
        <p>This coach isn’t offering private classes right now.</p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
            className="session-type-editor"
          >
            <label>
              Session type
              <select
                required
                disabled={busy}
                aria-label="Session type"
                value={typeId}
                onChange={(e) => {
                  clear();
                  setTypeId(e.target.value);
                  const t = types.find((t) => t.id === e.target.value);
                  setLocationId(t?.defaultLocationId ?? "");
                }}
              >
                <option value="">Choose a class</option>
                {types.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name} · {t.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>
            {type && <p>{type.description}</p>}
            <div className="session-type-fields">
              <label>
                Venue
                <select
                  required
                  disabled={busy || !!type?.defaultLocationId || !type}
                  aria-label="Venue"
                  value={locationId}
                  onChange={(e) => {
                    clear();
                    setLocationId(e.target.value);
                  }}
                >
                  <option value="">Choose a venue</option>
                  {catalog.locations
                    .filter(
                      (l) =>
                        !type?.defaultLocationId ||
                        type.defaultLocationId === l.id,
                    )
                    .map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Date
                <input
                  required
                  disabled={busy || !type}
                  type="date"
                  min={today}
                  max={max}
                  value={date}
                  onChange={(e) => {
                    clear();
                    setDate(e.target.value);
                  }}
                />
              </label>
            </div>
            <button
              className="button dark"
              disabled={busy || !type || !locationId || !date}
            >
              {busy ? "Checking…" : "Show available times"}
            </button>
          </form>
          {times && times.length > 0 && (
            <fieldset className="session-type-editor">
              <legend>Choose a start time · Berlin time</legend>
              <div className="session-type-toolbar">
                {times.map((t) => (
                  <label key={t.startsAt} className="session-type-time">
                    <input
                      type="radio"
                      name="class-time"
                      disabled={busy || sent}
                      checked={selected?.startsAt === t.startsAt}
                      onChange={() => {
                        setSelected(t);
                        setPending(null);
                        setMessage("");
                        setSent(false);
                      }}
                    />
                    {timeLabel(t.startsAt)}–{timeLabel(t.endsAt)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {selected && type && (
            <section
              className="session-type-editor"
              aria-label="Review session request"
            >
              <h3>Review your request</h3>
              <p>
                <strong>{type.name}</strong> · {type.durationMinutes} minutes
              </p>
              <p>
                {date} · {timeLabel(selected.startsAt)}–
                {timeLabel(selected.endsAt)} Berlin time
                <br />
                {catalog.locations.find((l) => l.id === locationId)?.name}
              </p>
              <p>
                The coach will confirm your request. Sending it doesn’t reserve
                the time.
              </p>
              {own ? (
                <p>
                  This is your coaching profile. Schedule a client from your
                  workspace.
                </p>
              ) : sent ? (
                <Link className="button dark" href="/sessions">
                  View My sessions
                </Link>
              ) : signedIn ? (
                <button
                  disabled={busy}
                  className="button dark"
                  onClick={() => void request()}
                >
                  {busy
                    ? "Sending…"
                    : pending
                      ? "Retry the same request"
                      : "Request session"}
                </button>
              ) : (
                <Link className="button dark" href={signInHref(returnTo)}>
                  Sign in to request
                </Link>
              )}
            </section>
          )}
        </>
      )}
      {catalog.types.some((t) => t.format === "group") && (
        <section className="session-type-editor">
          <h3>Group classes</h3>
          {catalog.types
            .filter((t) => t.format === "group")
            .map((t) => (
              <p key={t.id}>
                <Link href={`/events?sessionType=${t.id}`}>
                  {t.name} · {t.durationMinutes} min →
                </Link>
              </p>
            ))}
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
