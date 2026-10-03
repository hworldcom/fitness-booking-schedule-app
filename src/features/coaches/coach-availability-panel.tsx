"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  CalendarClock,
  Clock3,
  Eye,
  MapPin,
  Plus,
  Save,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  type CoachAvailabilityActionState,
  mutateCoachAvailabilityAction,
} from "@/app/coach/actions";
import {
  COACH_AVAILABILITY_DURATIONS,
  localDateTimeValue,
  type CoachProjection,
  type OwnedCoachAvailabilitySlot,
} from "@/domain/coaches";

const INITIAL_COACH_AVAILABILITY_ACTION_STATE: CoachAvailabilityActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

function slotDateTime(slot: OwnedCoachAvailabilitySlot) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(slot.startsAt));
}

function slotEndTime(slot: OwnedCoachAvailabilitySlot) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: slot.coachTimezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(slot.endsAt));
}

function slotDuration(slot: OwnedCoachAvailabilitySlot) {
  return Math.round(
    (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) /
      60_000,
  );
}

function ActionResult({
  state,
}: {
  state: typeof INITIAL_COACH_AVAILABILITY_ACTION_STATE;
}) {
  if (state.status === "idle") return null;
  return (
    <div
      className={`coach-availability-result ${state.status}`}
      role={state.status === "saved" ? "status" : "alert"}
      aria-live="polite"
    >
      <strong>{state.message}</strong>
      {state.errors.length > 0 && (
        <ul>
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlotEditor({ slot }: { slot: OwnedCoachAvailabilitySlot }) {
  const [state, formAction, pending] = useActionState(
    mutateCoachAvailabilityAction,
    INITIAL_COACH_AVAILABILITY_ACTION_STATE,
  );
  const editable = slot.status === "open";

  return (
    <article className="coach-slot-card">
      <div className="coach-slot-summary">
        <div>
          <span className={`coach-slot-status ${slot.status}`}>
            {slot.status}
          </span>
          <h3>{slotDateTime(slot)}</h3>
          <p>
            Until {slotEndTime(slot)} · {slot.coachTimezone}
          </p>
        </div>
        <div className="coach-slot-location">
          <MapPin size={17} aria-hidden="true" />
          <span>
            <strong>
              {slot.location.gymName ?? "Independent training place"}
            </strong>
            <small>{slot.location.label}</small>
          </span>
        </div>
      </div>

      {editable ? (
        <form className="coach-slot-edit-form" action={formAction}>
          <input type="hidden" name="slotId" value={slot.id} />
          <label className="coach-field">
            <span>Local start</span>
            <input
              type="datetime-local"
              name="localStart"
              defaultValue={localDateTimeValue(
                slot.startsAt,
                slot.coachTimezone,
              )}
              step={900}
              required
            />
          </label>
          <label className="coach-field">
            <span>Duration</span>
            <select
              name="durationMinutes"
              defaultValue={slotDuration(slot)}
              required
            >
              {COACH_AVAILABILITY_DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="coach-slot-refresh-location">
            <input type="checkbox" name="refreshLocation" />
            <span>
              Use my current profile location instead of this snapshot
            </span>
          </label>
          <div className="coach-slot-actions">
            <button
              className="button secondary"
              type="submit"
              name="intent"
              value="update"
              disabled={pending}
            >
              <Save size={15} aria-hidden="true" />
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              className="button coach-withdraw-button"
              type="submit"
              name="intent"
              value="withdraw"
              formNoValidate
              disabled={pending}
            >
              <Trash2 size={15} aria-hidden="true" /> Withdraw
            </button>
          </div>
          <ActionResult state={state} />
        </form>
      ) : (
        <p className="coach-slot-locked">
          This slot cannot be moved or withdrawn while it is {slot.status}.
          Booking lifecycle controls arrive with the booking feature.
        </p>
      )}
    </article>
  );
}

function CreateSlotForm({
  coach,
  suggestedLocalStart,
}: {
  coach: CoachProjection;
  suggestedLocalStart: string;
}) {
  const [state, formAction, pending] = useActionState(
    mutateCoachAvailabilityAction,
    INITIAL_COACH_AVAILABILITY_ACTION_STATE,
  );
  return (
    <form className="coach-slot-create" action={formAction}>
      <input type="hidden" name="intent" value="create" />
      <div className="coach-availability-section-title">
        <span>
          <Plus size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Publish a private-class slot</h2>
          <p>
            Enter time in {coach.timezone}. The slot copies your confirmed
            public place and stays there if your profile changes later.
          </p>
        </div>
      </div>
      <label className="coach-field">
        <span>Local start</span>
        <input
          type="datetime-local"
          name="localStart"
          defaultValue={suggestedLocalStart}
          step={900}
          required
        />
      </label>
      <label className="coach-field">
        <span>Duration</span>
        <select name="durationMinutes" defaultValue={60} required>
          {COACH_AVAILABILITY_DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {duration} minutes
            </option>
          ))}
        </select>
      </label>
      <div className="coach-slot-create-location">
        <MapPin size={18} aria-hidden="true" />
        <span>
          <strong>{coach.gymName ?? "Independent training place"}</strong>
          <small>{coach.location.label}</small>
        </span>
      </div>
      <button className="button dark" type="submit" disabled={pending}>
        <CalendarClock size={16} aria-hidden="true" />
        {pending ? "Publishing…" : "Publish slot"}
      </button>
      <ActionResult state={state} />
    </form>
  );
}

export function CoachAvailabilityPanel({
  coach,
  slots,
  ownerDisplayName,
  suggestedLocalStart,
}: {
  coach: CoachProjection | null;
  slots: readonly OwnedCoachAvailabilitySlot[];
  ownerDisplayName: string;
  suggestedLocalStart?: string;
}) {
  return (
    <div className="coach-workspace">
      <header className="coach-workspace-header">
        <div>
          <span className="eyebrow">COACH WORKSPACE</span>
          <h1>
            Plan your next week<span className="lime-text">.</span>
          </h1>
          <p>
            Welcome, {ownerDisplayName}. Publish exact capacity-one times that
            clients can discover. Nothing here tracks your live location.
          </p>
        </div>
        {coach?.visibility === "visible" && (
          <Link className="button secondary" href={`/coaches/${coach.slug}`}>
            <Eye size={16} aria-hidden="true" /> View public profile
          </Link>
        )}
      </header>

      <nav className="coach-workspace-nav" aria-label="Coach workspace">
        <Link href="/coach" aria-current="page" className="active">
          <CalendarClock size={17} aria-hidden="true" /> Availability
        </Link>
        <Link href="/profile/coach">
          <UserRound size={17} aria-hidden="true" /> Profile
        </Link>
      </nav>

      {!coach ? (
        <section className="coach-workspace-gate">
          <Settings2 size={27} aria-hidden="true" />
          <span className="eyebrow">PROFILE REQUIRED</span>
          <h2>Create your coach profile first.</h2>
          <p>
            Availability needs a reviewed timezone and one confirmed public
            training place to snapshot into every slot.
          </p>
          <Link className="button dark" href="/profile/coach">
            Set up coach profile
          </Link>
        </section>
      ) : coach.visibility !== "visible" ? (
        <section className="coach-workspace-gate">
          <Eye size={27} aria-hidden="true" />
          <span className="eyebrow">PROFILE HIDDEN</span>
          <h2>Publish your profile before offering times.</h2>
          <p>
            Hidden coaches cannot create public availability. Existing slot
            snapshots remain stored but are not shown to guests.
          </p>
          <Link className="button dark" href="/profile/coach">
            Review profile visibility
          </Link>
        </section>
      ) : (
        <>
          <CreateSlotForm
            coach={coach}
            suggestedLocalStart={suggestedLocalStart ?? ""}
          />
          <section className="coach-availability-list">
            <div className="coach-availability-list-heading">
              <div>
                <span className="eyebrow">ROLLING SEVEN-DAY WINDOW</span>
                <h2>Your upcoming availability</h2>
              </div>
              <span className="coach-slot-count">
                {slots.length} active slot{slots.length === 1 ? "" : "s"}
              </span>
            </div>
            {slots.length === 0 ? (
              <div className="coach-availability-empty">
                <Clock3 size={25} aria-hidden="true" />
                <h3>No upcoming slots yet.</h3>
                <p>
                  Publish an exact start time above. Recurring schedules are
                  intentionally outside this P0 flow.
                </p>
              </div>
            ) : (
              <div className="coach-slot-list">
                {slots.map((slot) => (
                  <SlotEditor
                    key={`${slot.id}:${slot.startsAt}:${slot.endsAt}:${slot.location.confirmedAt}`}
                    slot={slot}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
