"use client";

import {
  CalendarDays,
  Eye,
  Plus,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  saveGroupEventDraftAction,
  transitionGroupEventDraftAction,
  type GroupEventDraftActionResult,
} from "@/app/coach/events/actions";
import {
  parseGroupEventPoolTerms,
  zonedLocalDateTimeToIso,
} from "@/domain/group-event-marketplace";
import type { CoachProjection } from "@/domain/coaches";
import type { GroupEventProjection } from "@/domain/group-events";
import { GroupEventOperationPanel } from "./group-event-operation-panel";

function localInputValue(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function initialLocalDate(offsetDays: number, hour: number, timeZone: string) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const localDate = localInputValue(date.toISOString(), timeZone).slice(0, 10);
  return `${localDate}T${String(hour).padStart(2, "0")}:00`;
}

function initialFundingDeadline(startsAt: string, timeZone: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  return localInputValue(
    new Date(now + (start - now) / 2).toISOString(),
    timeZone,
  );
}

function ActionResult({
  result,
}: {
  result: GroupEventDraftActionResult | null;
}) {
  if (!result) return null;
  return (
    <div
      className={`group-event-form-result ${result.status}`}
      role={result.status === "saved" ? "status" : "alert"}
    >
      <strong>{result.message}</strong>
      {result.errors.length > 0 && (
        <ul>
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupEventDraftForm({
  coach,
  event,
}: {
  coach: CoachProjection;
  event?: GroupEventProjection;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GroupEventDraftActionResult | null>(
    null,
  );
  const disciplines = Array.from(
    new Set(
      event ? [event.discipline, ...coach.disciplines] : coach.disciplines,
    ),
  );

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (busy) return;
    setBusy(true);
    const formElement = formEvent.currentTarget;
    const form = new FormData(formElement);
    let startsAt: string;
    let endsAt: string;
    try {
      startsAt = zonedLocalDateTimeToIso(
        String(form.get("startsAtLocal") ?? ""),
        coach.timezone,
      );
      endsAt = zonedLocalDateTimeToIso(
        String(form.get("endsAtLocal") ?? ""),
        coach.timezone,
      );
    } catch (error) {
      setResult(
        Object.freeze({
          status: "invalid",
          message:
            error instanceof Error
              ? error.message
              : "Review the local event schedule.",
          errors: Object.freeze(["schedule"]),
        }),
      );
      setBusy(false);
      return;
    }
    try {
      const next = await saveGroupEventDraftAction({
        intent: event ? "update" : "create",
        eventId: event?.id,
        title: form.get("title"),
        discipline: form.get("discipline"),
        description: form.get("description"),
        startsAt,
        endsAt,
        mediaUrl: form.get("mediaUrl") || null,
      });
      setResult(next);
      if (next.status === "saved") {
        if (!event) formElement.reset();
        router.refresh();
      }
    } catch {
      setResult(
        Object.freeze({
          status: "unavailable",
          message: "MovX could not save this event right now.",
          errors: Object.freeze([]),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="group-event-form"
      onSubmit={(formEvent) => void submit(formEvent)}
    >
      <ActionResult result={result} />
      <div className="group-event-form-grid">
        <label>
          <span>Event title</span>
          <input
            name="title"
            minLength={3}
            maxLength={120}
            required
            defaultValue={event?.title ?? ""}
            placeholder="Saturday striking workshop"
          />
        </label>
        <label>
          <span>Discipline</span>
          <select
            name="discipline"
            defaultValue={event?.discipline ?? coach.disciplines[0]}
          >
            {disciplines.map((discipline) => (
              <option key={discipline}>{discipline}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Starts ({coach.timezone})</span>
          <input
            name="startsAtLocal"
            type="datetime-local"
            required
            defaultValue={
              event
                ? localInputValue(event.startsAt, coach.timezone)
                : initialLocalDate(14, 10, coach.timezone)
            }
          />
        </label>
        <label>
          <span>Ends ({coach.timezone})</span>
          <input
            name="endsAtLocal"
            type="datetime-local"
            required
            defaultValue={
              event
                ? localInputValue(event.endsAt, coach.timezone)
                : initialLocalDate(14, 12, coach.timezone)
            }
          />
        </label>
        <label className="wide">
          <span>Description</span>
          <textarea
            name="description"
            minLength={20}
            maxLength={2000}
            required
            defaultValue={event?.description ?? ""}
            placeholder="Explain the session, level and what the group will work on."
          />
        </label>
        <label className="wide">
          <span>Optional HTTPS or site image URL</span>
          <input
            name="mediaUrl"
            type="text"
            inputMode="url"
            defaultValue={event?.mediaUrl ?? ""}
            placeholder="https://…"
          />
        </label>
      </div>
      <button className="button dark" type="submit" disabled={busy}>
        {busy ? "Saving…" : event ? "Update draft" : "Create draft"}
      </button>
    </form>
  );
}

function DraftTransition({
  event,
  intent,
}: {
  event: GroupEventProjection;
  intent: "publish" | "withdraw";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GroupEventDraftActionResult | null>(
    null,
  );

  async function transition() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await transitionGroupEventDraftAction({
        eventId: event.id,
        intent,
      });
      setResult(next);
      if (next.status === "saved") router.refresh();
    } catch {
      setResult(
        Object.freeze({
          status: "unavailable",
          message: "MovX could not update this event right now.",
          errors: Object.freeze([]),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group-event-transition">
      <button
        type="button"
        className={intent === "publish" ? "button dark" : "button secondary"}
        onClick={() => void transition()}
        disabled={busy}
      >
        {busy
          ? "Saving…"
          : intent === "publish"
            ? "Publish event"
            : "Withdraw draft"}
      </button>
      <ActionResult result={result} />
    </div>
  );
}

function EventPoolCreator({
  event,
  coach,
  coachAuthorityAddress,
}: {
  event: GroupEventProjection;
  coach: CoachProjection;
  coachAuthorityAddress: string;
}) {
  const [request, setRequest] = useState<{
    kind: "create";
    eventId: string;
    coachAuthorityAddress: string;
    seatPriceEurcBaseUnits: string;
    minimumParticipants: number;
    maximumParticipants: number;
    fundingDeadline: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function review(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    try {
      const terms = parseGroupEventPoolTerms({
        seatPriceEurc: String(form.get("seatPriceEurc") ?? ""),
        minimumParticipants: Number(form.get("minimumParticipants")),
        maximumParticipants: Number(form.get("maximumParticipants")),
        fundingDeadlineLocal: String(form.get("fundingDeadlineLocal") ?? ""),
        timeZone: coach.timezone,
        eventStartsAt: event.startsAt,
      });
      setError(null);
      setRequest({
        kind: "create",
        eventId: event.id,
        coachAuthorityAddress,
        ...terms,
      });
    } catch (caught) {
      setRequest(null);
      setError(
        caught instanceof Error ? caught.message : "Review the pool terms.",
      );
    }
  }

  if (request) {
    return (
      <GroupEventOperationPanel
        mode="prepare"
        request={request}
        label="Simulate exact pool creation"
        description="Preparing fixes the pool address and makes these event terms immutable. Your current linked wallet authorizes creation; MovX pays SOL fees and rent."
      />
    );
  }

  return (
    <form className="group-event-pool-form" onSubmit={review}>
      <h3>Set the immutable funding terms</h3>
      <p>
        These values are re-derived and simulated on the server before the
        wallet opens.
      </p>
      {error && (
        <p className="group-event-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {error}
        </p>
      )}
      <div className="group-event-form-grid compact">
        <label>
          <span>Seat price · test EURC</span>
          <input
            name="seatPriceEurc"
            inputMode="decimal"
            defaultValue="25"
            required
          />
        </label>
        <label>
          <span>Funding closes ({coach.timezone})</span>
          <input
            name="fundingDeadlineLocal"
            type="datetime-local"
            defaultValue={initialFundingDeadline(
              event.startsAt,
              coach.timezone,
            )}
            required
          />
        </label>
        <label>
          <span>Minimum participants</span>
          <input
            name="minimumParticipants"
            type="number"
            min={2}
            max={50}
            defaultValue={4}
            required
          />
        </label>
        <label>
          <span>Maximum participants</span>
          <input
            name="maximumParticipants"
            type="number"
            min={2}
            max={50}
            defaultValue={12}
            required
          />
        </label>
      </div>
      <button className="button dark" type="submit">
        Review pool terms
      </button>
    </form>
  );
}

function ManagedEvent({
  event,
  coach,
  coachAuthorityAddress,
}: {
  event: GroupEventProjection;
  coach: CoachProjection;
  coachAuthorityAddress: string | null;
}) {
  const editable =
    event.publicationStatus === "draft" &&
    event.projectionAvailability === "unbound";
  return (
    <article className="group-event-managed-card">
      <div className="group-event-managed-heading">
        <div>
          <span className="eyebrow">
            {event.publicationStatus} · {event.projectionAvailability}
          </span>
          <h2>{event.title}</h2>
          <p>
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: coach.timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(event.startsAt))}
          </p>
        </div>
        {event.publicationStatus === "published" && (
          <Link className="button secondary" href={`/events/${event.slug}`}>
            <Eye size={16} aria-hidden="true" /> Public view
          </Link>
        )}
      </div>

      {editable && (
        <details className="group-event-editor">
          <summary>Edit event details</summary>
          <GroupEventDraftForm coach={coach} event={event} />
        </details>
      )}

      {editable && coachAuthorityAddress && (
        <EventPoolCreator
          event={event}
          coach={coach}
          coachAuthorityAddress={coachAuthorityAddress}
        />
      )}
      {editable && !coachAuthorityAddress && (
        <div className="group-event-authority-gate">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            Publish the coach’s Devnet pass offers first. The verified
            CoachAuthority program address anchors the event while the coach
            keeps one normal wallet.
          </p>
          <Link className="button secondary" href={`/coaches/${coach.slug}`}>
            Review coach marketplace setup
          </Link>
        </div>
      )}
      {editable && <DraftTransition event={event} intent="withdraw" />}

      {event.publicationStatus === "draft" &&
        event.projectionAvailability === "pending" && (
          <div className="group-event-recovery-card">
            <p className="group-event-operation-alert" role="status">
              Pool creation is pending verification. Recover the prepared
              operation before creating a replacement.
            </p>
            <GroupEventOperationPanel
              mode="recover"
              eventId={event.id}
              description="Reload recovery uses the durable operation ID saved after simulation. A prepared transaction can reopen for exact review; a submitted transaction is checked without a duplicate send."
            />
          </div>
        )}
      {event.publicationStatus === "draft" &&
        event.projectionAvailability === "unavailable" && (
          <div className="group-event-recovery-card">
            <p className="group-event-operation-alert" role="alert">
              The bound pool could not be read from finalized Devnet state. Keep
              its recovery ID and do not create another pool.
            </p>
            <GroupEventOperationPanel
              mode="recover"
              eventId={event.id}
              description="Retry recovery of the original operation. MovX will inspect its saved signature and finalized accounts rather than prepare a replacement."
            />
          </div>
        )}
      {event.publicationStatus === "draft" &&
        event.projectionAvailability === "current" && (
          <div className="group-event-publish-ready">
            <p>
              Finalized pool terms are verified. Publish to make this event
              discoverable.
            </p>
            <DraftTransition event={event} intent="publish" />
          </div>
        )}
      {event.publicationStatus === "withdrawn" && (
        <p>
          This unbound draft was withdrawn and remains as an immutable record.
        </p>
      )}
    </article>
  );
}

export function GroupEventManager({
  coach,
  events,
  coachAuthorityAddress,
}: {
  coach: CoachProjection;
  events: readonly GroupEventProjection[];
  coachAuthorityAddress: string | null;
}) {
  return (
    <div className="coach-workspace group-event-manager">
      <header className="coach-workspace-header">
        <div>
          <span className="eyebrow">COACH WORKSPACE</span>
          <h1>
            Build a group event<span className="lime-text">.</span>
          </h1>
          <p>
            Draft the class first, then review one immutable Devnet pool with a
            fixed seat price, threshold, capacity and funding deadline.
          </p>
        </div>
        <Link className="button secondary" href="/events">
          <Eye size={16} aria-hidden="true" /> Browse public events
        </Link>
      </header>

      <nav className="coach-workspace-nav" aria-label="Coach workspace">
        <Link href="/coach">
          <CalendarDays size={17} aria-hidden="true" /> Schedule
        </Link>
        <Link href="/coach/events" aria-current="page" className="active">
          <Plus size={17} aria-hidden="true" /> Group events
        </Link>
        <Link href="/profile/coach">
          <UserRound size={17} aria-hidden="true" /> Profile
        </Link>
      </nav>

      <section className="group-event-create-card">
        <span className="eyebrow">NEW EVENT DRAFT</span>
        <h2>Describe the class before setting funding terms.</h2>
        <p>
          Times use {coach.timezone}. Draft details stay editable until pool
          preparation fixes their chain-backed terms.
        </p>
        <GroupEventDraftForm coach={coach} />
      </section>

      <section className="group-event-owned-list">
        <div>
          <span className="eyebrow">YOUR GROUP EVENTS</span>
          <h2>
            {events.length} event record{events.length === 1 ? "" : "s"}
          </h2>
        </div>
        {events.length === 0 ? (
          <p>No event drafts yet.</p>
        ) : (
          events.map((event) => (
            <ManagedEvent
              key={event.id}
              event={event}
              coach={coach}
              coachAuthorityAddress={coachAuthorityAddress}
            />
          ))
        )}
      </section>
    </div>
  );
}
