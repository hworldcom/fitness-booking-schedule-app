"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarClock,
  Check,
  Clock3,
  Eye,
  MapPin,
  Settings2,
  UserRound,
} from "lucide-react";
import type { CoachAvailabilityActionState } from "@/app/coach/actions";
import type {
  CoachAvailabilityIsoWeekday,
  CoachProjection,
  OwnedCoachAvailabilityRule,
  OwnedCoachAvailabilitySlot,
} from "@/domain/coaches";

const INITIAL_COACH_AVAILABILITY_ACTION_STATE: CoachAvailabilityActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

type CoachAvailabilityRuleAction = (
  previousState: CoachAvailabilityActionState,
  formData: FormData,
) => Promise<CoachAvailabilityActionState>;

const WEEKDAYS = Object.freeze([
  { isoWeekday: 1, short: "Mon", long: "Monday" },
  { isoWeekday: 2, short: "Tue", long: "Tuesday" },
  { isoWeekday: 3, short: "Wed", long: "Wednesday" },
  { isoWeekday: 4, short: "Thu", long: "Thursday" },
  { isoWeekday: 5, short: "Fri", long: "Friday" },
  { isoWeekday: 6, short: "Sat", long: "Saturday" },
  { isoWeekday: 7, short: "Sun", long: "Sunday" },
] as const);

const WORKING_WEEK_HOURS = Object.freeze(
  Array.from(
    { length: 23 },
    (_, hour) => `${String(hour).padStart(2, "0")}:00`,
  ),
);

function endTime(localStartTime: string) {
  return `${String(Number(localStartTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
}

function ruleKey(
  isoWeekday: CoachAvailabilityIsoWeekday,
  localStartTime: string,
) {
  return `${isoWeekday}:${localStartTime}`;
}

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

function ActionResult({ state }: { state: CoachAvailabilityActionState }) {
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

function ScheduleCell({
  isoWeekday,
  weekday,
  localStartTime,
  rule,
  pending,
  gridColumn,
  gridRow,
}: {
  isoWeekday: CoachAvailabilityIsoWeekday;
  weekday: string;
  localStartTime: string;
  rule: OwnedCoachAvailabilityRule | undefined;
  pending: boolean;
  gridColumn: number;
  gridRow: number;
}) {
  const selected = Boolean(rule);
  const interval = `${localStartTime}–${endTime(localStartTime)}`;
  const action = selected ? "Remove" : "Add";

  return (
    <button
      type="submit"
      name="scheduleCell"
      value={`${selected ? "remove-rule" : "create-rule"}|${isoWeekday}|${localStartTime}|${rule?.id ?? ""}`}
      className={`coach-week-cell${selected ? " selected" : ""}`}
      style={{ gridColumn, gridRow }}
      aria-pressed={selected}
      aria-label={`${action} ${weekday} ${interval}`}
      title={`${action} ${weekday} ${interval}`}
      disabled={pending}
    >
      {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      <span aria-hidden="true">{selected ? "Available" : "Add"}</span>
    </button>
  );
}

function WorkingWeekEditor({
  coach,
  rules,
  mutateRuleAction,
}: {
  coach: CoachProjection;
  rules: readonly OwnedCoachAvailabilityRule[];
  mutateRuleAction: CoachAvailabilityRuleAction;
}) {
  const [state, formAction, pending] = useActionState(
    mutateRuleAction,
    INITIAL_COACH_AVAILABILITY_ACTION_STATE,
  );
  const rulesByCell = new Map(
    rules.map((rule) => [ruleKey(rule.isoWeekday, rule.localStartTime), rule]),
  );
  const [mobileDay, setMobileDay] = useState<CoachAvailabilityIsoWeekday>(
    rules[0]?.isoWeekday ?? 1,
  );

  return (
    <section className="coach-working-week" aria-busy={pending}>
      <div className="coach-working-week-heading">
        <div>
          <span className="eyebrow">YOUR REPEATING SCHEDULE</span>
          <h2>Your working week</h2>
          <p>
            Choose each hour you normally teach. Selected cells repeat every
            week in {coach.timezone}; you do not need to add future dates one by
            one.
          </p>
        </div>
        <span className="coach-slot-count">
          {rules.length} selected hour{rules.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="coach-week-context">
        <CalendarClock size={18} aria-hidden="true" />
        <span>
          <strong>Every selected cell is one hour.</strong>
          <small>
            Removing one stops future open times. Held or booked classes stay
            unchanged.
          </small>
        </span>
        <MapPin size={18} aria-hidden="true" />
        <span>
          <strong>{coach.gymName ?? "Independent training place"}</strong>
          <small>
            New dated times copy {coach.location.label}; later profile edits do
            not move existing classes.
          </small>
        </span>
      </div>

      <form action={formAction}>
        <ActionResult state={state} />
        <label className="coach-week-mobile-picker">
          <span>Day</span>
          <select
            value={mobileDay}
            onChange={(event) =>
              setMobileDay(
                Number(event.target.value) as CoachAvailabilityIsoWeekday,
              )
            }
          >
            {WEEKDAYS.map((day) => {
              const selectedCount = rules.filter(
                (rule) => rule.isoWeekday === day.isoWeekday,
              ).length;
              return (
                <option key={day.isoWeekday} value={day.isoWeekday}>
                  {day.long} · {selectedCount} selected
                </option>
              );
            })}
          </select>
        </label>
        <div
          className="coach-week-grid"
          role="grid"
          aria-label={`Repeating weekly availability in ${coach.timezone}`}
        >
          <div className="coach-week-corner" role="columnheader">
            Time
          </div>
          {WORKING_WEEK_HOURS.map((localStartTime, hourIndex) => (
            <div
              className="coach-week-time-label"
              role="rowheader"
              style={{ gridColumn: 1, gridRow: hourIndex + 2 }}
              key={localStartTime}
            >
              <span>{localStartTime}</span>
              <small>{endTime(localStartTime)}</small>
            </div>
          ))}
          {WEEKDAYS.map((day, dayIndex) => {
            const selectedCount = rules.filter(
              (rule) => rule.isoWeekday === day.isoWeekday,
            ).length;
            return (
              <section
                className={`coach-week-day${mobileDay === day.isoWeekday ? " current" : ""}`}
                aria-label={day.long}
                key={day.isoWeekday}
              >
                <h3
                  className="coach-week-day-heading"
                  role="columnheader"
                  style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                >
                  <span>{day.short}</span>
                  <small>
                    {day.long} · {selectedCount}
                  </small>
                </h3>
                <div className="coach-week-day-slots">
                  {WORKING_WEEK_HOURS.map((localStartTime, hourIndex) => (
                    <div className="coach-mobile-hour" key={localStartTime}>
                      <span className="coach-mobile-time">
                        {`${localStartTime}–${endTime(localStartTime)}`}
                      </span>
                      <ScheduleCell
                        isoWeekday={day.isoWeekday}
                        weekday={day.long}
                        localStartTime={localStartTime}
                        rule={rulesByCell.get(
                          ruleKey(day.isoWeekday, localStartTime),
                        )}
                        pending={pending}
                        gridColumn={dayIndex + 2}
                        gridRow={hourIndex + 2}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </form>
    </section>
  );
}

function UpcomingOccurrences({
  slots,
}: {
  slots: readonly OwnedCoachAvailabilitySlot[];
}) {
  return (
    <section className="coach-availability-list">
      <div className="coach-availability-list-heading">
        <div>
          <span className="eyebrow">NEXT SEVEN DAYS</span>
          <h2>Dated class times</h2>
          <p>
            These are the concrete capacity-one times clients can see. Your
            working week creates them automatically.
          </p>
        </div>
        <span className="coach-slot-count">
          {slots.length} upcoming time{slots.length === 1 ? "" : "s"}
        </span>
      </div>
      {slots.length === 0 ? (
        <div className="coach-availability-empty">
          <Clock3 size={25} aria-hidden="true" />
          <h3>No dated times in the next seven days.</h3>
          <p>
            Choose an hour in your working week above. Valid future occurrences
            will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="coach-occurrence-list">
          {slots.map((slot) => (
            <li key={slot.id}>
              <div>
                <span className={`coach-slot-status ${slot.status}`}>
                  {slot.status}
                </span>
                <strong>{slotDateTime(slot)}</strong>
                <small>
                  Until {slotEndTime(slot)} · {slot.coachTimezone}
                </small>
              </div>
              <div>
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>
                    {slot.location.gymName ?? "Independent training place"}
                  </strong>
                  <small>{slot.location.label}</small>
                </span>
              </div>
              <em>
                {slot.recurrenceRuleId ? "Working week" : "Earlier one-off"}
              </em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CoachAvailabilityPanel({
  coach,
  rules,
  slots,
  clientCards,
  ownerDisplayName,
  mutateRuleAction,
}: {
  coach: CoachProjection | null;
  rules: readonly OwnedCoachAvailabilityRule[];
  slots: readonly OwnedCoachAvailabilitySlot[];
  clientCards?: ReactNode;
  ownerDisplayName: string;
  mutateRuleAction: CoachAvailabilityRuleAction;
}) {
  return (
    <div className="coach-workspace">
      <header className="coach-workspace-header">
        <div>
          <span className="eyebrow">COACH WORKSPACE</span>
          <h1>
            Set your working week<span className="lime-text">.</span>
          </h1>
          <p>
            Welcome, {ownerDisplayName}. Choose the one-hour times you normally
            teach once, and MovX keeps the next seven days ready for clients.
            Nothing here tracks your live location.
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
          <CalendarClock size={17} aria-hidden="true" /> Schedule
        </Link>
        <Link href="/profile/coach">
          <UserRound size={17} aria-hidden="true" /> Profile
        </Link>
        <Link href="/coach/events">
          <CalendarDays size={17} aria-hidden="true" /> Group events
        </Link>
        {coach?.visibility === "visible" && (
          <Link href="#client-cards">
            <UserRound size={17} aria-hidden="true" /> Clients
          </Link>
        )}
      </nav>

      {!coach ? (
        <section className="coach-workspace-gate">
          <Settings2 size={27} aria-hidden="true" />
          <span className="eyebrow">PROFILE REQUIRED</span>
          <h2>Create your coach profile first.</h2>
          <p>
            Your working week needs a reviewed timezone and one confirmed public
            training place to snapshot into every dated class time.
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
            Hidden coaches cannot create public availability. Existing class
            snapshots remain stored but are not shown to guests.
          </p>
          <Link className="button dark" href="/profile/coach">
            Review profile visibility
          </Link>
        </section>
      ) : (
        <>
          <WorkingWeekEditor
            coach={coach}
            rules={rules}
            mutateRuleAction={mutateRuleAction}
          />
          <UpcomingOccurrences slots={slots} />
          {clientCards}
        </>
      )}
    </div>
  );
}
