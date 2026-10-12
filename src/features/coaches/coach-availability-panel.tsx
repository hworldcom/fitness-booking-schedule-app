"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  Check,
  Clock3,
  Eye,
  MapPin,
  Save,
  Settings2,
} from "lucide-react";
import type { CoachAvailabilityActionState } from "@/app/coach/actions";
import {
  coachAvailabilityCellKey,
  type CoachAvailabilityRuleInput,
  type CoachAvailabilityIsoWeekday,
  type CoachProjection,
  type CoachTrainingLocation,
  type OwnedCoachAvailabilityRule,
  type OwnedCoachAvailabilitySlot,
} from "@/domain/coaches";
import {
  coachScheduleAssignment,
  createCoachScheduleDraft,
  resolveCoachScheduleCell,
  serializeCoachScheduleDraft,
  toggleCoachScheduleCell,
} from "@/features/coaches/coach-schedule-draft";
import { assignCoachLocationPaletteIndexes } from "@/features/coaches/coach-location-palette";
import type { CoachWorkspaceView } from "@/features/coaches/coach-workspace-view";
import { CoachWorkspaceNavigation } from "@/features/coaches/coach-workspace-navigation";
import { CoachWorkspaceHeader } from "@/features/coaches/coach-workspace-header";

const INITIAL_COACH_AVAILABILITY_ACTION_STATE: CoachAvailabilityActionState =
  Object.freeze({ status: "idle", message: "", errors: Object.freeze([]) });

type CoachAvailabilityRuleSetAction = (
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

const LOCATION_PALETTE = Object.freeze([
  Object.freeze({ background: "#dff1c4", border: "#789b54", ink: "#29451f" }),
  Object.freeze({ background: "#e7ddf6", border: "#9a82bd", ink: "#49345f" }),
  Object.freeze({ background: "#f9ded2", border: "#c47b62", ink: "#693928" }),
  Object.freeze({ background: "#d8edf0", border: "#6e9da6", ink: "#244d55" }),
  Object.freeze({ background: "#f4e7b9", border: "#b39a4d", ink: "#5b4819" }),
  Object.freeze({ background: "#dfe7fa", border: "#7f96c6", ink: "#30436b" }),
]);

type CoachLocationStyle = CSSProperties &
  Readonly<{
    "--coach-location-background": string;
    "--coach-location-border": string;
    "--coach-location-ink": string;
  }>;

function locationStyle(paletteIndex: number): CoachLocationStyle {
  const palette = LOCATION_PALETTE[paletteIndex];
  return {
    "--coach-location-background": palette.background,
    "--coach-location-border": palette.border,
    "--coach-location-ink": palette.ink,
  };
}

function endTime(localStartTime: string) {
  return `${String(Number(localStartTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
}

function scheduleRuleKey(
  isoWeekday: CoachAvailabilityIsoWeekday,
  localStartTime: string,
) {
  return coachAvailabilityCellKey({ isoWeekday, localStartTime });
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
  weekday,
  localStartTime,
  assignment,
  assignmentLocation,
  paletteIndex,
  selectedLocation,
  pending,
  onToggle,
  gridColumn,
  gridRow,
}: {
  weekday: string;
  localStartTime: string;
  assignment: CoachAvailabilityRuleInput | null;
  assignmentLocation: CoachTrainingLocation | null;
  paletteIndex: number;
  selectedLocation: CoachTrainingLocation;
  pending: boolean;
  onToggle: () => void;
  gridColumn: number;
  gridRow: number;
}) {
  const interval = `${localStartTime}–${endTime(localStartTime)}`;
  const selected = assignment !== null;
  const assignmentName =
    assignmentLocation?.publicName ?? "Unavailable location";
  const sameLocation = assignment?.locationId === selectedLocation.id;
  const action = !assignment
    ? `Assign ${selectedLocation.publicName} to`
    : sameLocation
      ? `Remove ${assignmentName} from`
      : `Review ${weekday} ${interval}, assigned to ${assignmentName}; selected location is ${selectedLocation.publicName}`;
  const label =
    assignment && !sameLocation ? action : `${action} ${weekday} ${interval}`;

  return (
    <button
      type="button"
      className={`coach-week-cell${selected ? " selected" : ""}${assignment && !sameLocation ? " assigned-elsewhere" : ""}`}
      style={
        assignment
          ? {
              ...locationStyle(paletteIndex),
              gridColumn,
              gridRow,
            }
          : { gridColumn, gridRow }
      }
      data-training-location-id={assignment?.locationId}
      data-location-palette={assignment ? paletteIndex : undefined}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={onToggle}
    >
      {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      <span className="coach-week-cell-location">
        {selected ? assignmentName : "Add"}
      </span>
    </button>
  );
}

function WorkingWeekEditor({
  coach,
  rules,
  saveRuleSetAction,
}: {
  coach: CoachProjection;
  rules: readonly OwnedCoachAvailabilityRule[];
  saveRuleSetAction: CoachAvailabilityRuleSetAction;
}) {
  const activeLocations = [...coach.locations]
    .filter((location) => location.status === "active")
    .sort(
      (left, right) =>
        Number(right.isPrimary) - Number(left.isPrimary) ||
        left.sortOrder - right.sortOrder,
    );
  const primaryLocation = activeLocations.find(
    (location) => location.id === coach.primaryLocationId && location.isPrimary,
  );
  if (!primaryLocation) {
    throw new Error("The coach primary training location is unavailable.");
  }
  const locationById = new Map(
    activeLocations.map((location) => [location.id, location]),
  );
  const locationPaletteIndexes = assignCoachLocationPaletteIndexes(
    [
      ...activeLocations.map((location) => location.id),
      ...rules.map((rule) => rule.locationId),
    ],
    LOCATION_PALETTE.length,
  );
  const initialAssignments = () => createCoachScheduleDraft(rules);
  const [savedAssignments, setSavedAssignments] = useState(initialAssignments);
  const [draftAssignments, setDraftAssignments] = useState(initialAssignments);
  const [selectedLocationId, setSelectedLocationId] = useState(
    primaryLocation.id,
  );
  const [pendingDecision, setPendingDecision] =
    useState<CoachAvailabilityRuleInput | null>(null);
  const [state, setState] = useState(INITIAL_COACH_AVAILABILITY_ACTION_STATE);
  const [pending, startTransition] = useTransition();
  const moveDecisionRef = useRef<HTMLButtonElement>(null);
  const [mobileDay, setMobileDay] = useState<CoachAvailabilityIsoWeekday>(
    rules[0]?.isoWeekday ?? 1,
  );
  const selectedLocation =
    locationById.get(selectedLocationId) ?? primaryLocation;
  const expectedRules = serializeCoachScheduleDraft(savedAssignments);
  const selectedRules = serializeCoachScheduleDraft(draftAssignments);
  const dirty = expectedRules !== selectedRules;
  const pendingKey = pendingDecision
    ? coachAvailabilityCellKey(pendingDecision)
    : null;
  const pendingExisting = pendingKey
    ? (draftAssignments.get(pendingKey) ?? null)
    : null;
  const pendingExistingLocation = pendingExisting
    ? (locationById.get(pendingExisting.locationId) ?? null)
    : null;
  const pendingWeekday = pendingDecision
    ? WEEKDAYS.find(
        (weekday) => weekday.isoWeekday === pendingDecision.isoWeekday,
      )
    : null;

  useEffect(() => {
    if (pendingDecision) moveDecisionRef.current?.focus();
  }, [pendingDecision]);

  function clearSavedFeedback() {
    if (state.status === "saved") {
      setState(INITIAL_COACH_AVAILABILITY_ACTION_STATE);
    }
  }

  function toggleRule(
    isoWeekday: CoachAvailabilityIsoWeekday,
    localStartTime: string,
  ) {
    const requested = coachScheduleAssignment(
      selectedLocation,
      isoWeekday,
      localStartTime,
    );
    const update = toggleCoachScheduleCell(draftAssignments, requested);
    if (update.outcome === "decision-required") {
      setPendingDecision(requested);
      return;
    }
    setPendingDecision(null);
    setDraftAssignments(update.assignments);
    clearSavedFeedback();
  }

  function resolveDecision(resolution: "keep" | "move" | "remove") {
    if (!pendingDecision) return;
    const next = resolveCoachScheduleCell(
      draftAssignments,
      pendingDecision,
      resolution,
    );
    if (resolution !== "keep") {
      setDraftAssignments(next);
      clearSavedFeedback();
    }
    setPendingDecision(null);
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || pending || pendingDecision) return;
    const formData = new FormData(event.currentTarget);
    const savedDraft = new Map(draftAssignments);
    setState(INITIAL_COACH_AVAILABILITY_ACTION_STATE);
    startTransition(async () => {
      try {
        const nextState = await saveRuleSetAction(
          INITIAL_COACH_AVAILABILITY_ACTION_STATE,
          formData,
        );
        setState(nextState);
        if (nextState.status === "saved") {
          setSavedAssignments(savedDraft);
        }
      } catch {
        setState({
          status: "unavailable",
          message: "MovX could not save that working week. Nothing changed.",
          errors: Object.freeze([]),
        });
      }
    });
  }

  return (
    <section className="coach-working-week" aria-busy={pending}>
      <form onSubmit={saveSchedule}>
        <input type="hidden" name="selectedRules" value={selectedRules} />
        <input type="hidden" name="expectedRules" value={expectedRules} />
        <div className="coach-working-week-heading">
          <div>
            <span className="eyebrow">YOUR REPEATING SCHEDULE</span>
            <h2>Weekly schedule</h2>
            <p>
              Choose times first, then save once. Every selected one-hour block
              repeats in {coach.timezone} and belongs to a training location.
            </p>
          </div>
          <div className="coach-week-heading-actions">
            <span className="coach-slot-count">
              {draftAssignments.size} selected hour
              {draftAssignments.size === 1 ? "" : "s"}
              {dirty ? " · Unsaved" : ""}
            </span>
            <button
              type="submit"
              className="button dark"
              disabled={!dirty || pending || pendingDecision !== null}
            >
              <Save size={16} aria-hidden="true" />
              {pending ? "Saving schedule…" : "Save schedule"}
            </button>
          </div>
        </div>

        <ActionResult state={state} />
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
            <strong>{selectedLocation.publicName}</strong>
            <small>
              New assignments use the location tool below. Existing cells keep
              their saved venue until you explicitly move them.
            </small>
          </span>
        </div>
        <div className="coach-week-location-tools">
          <label className="coach-week-location-selector">
            <span>
              <MapPin size={17} aria-hidden="true" /> Assignment location
            </span>
            <select
              value={selectedLocation.id}
              onChange={(event) => {
                setSelectedLocationId(event.target.value);
                setPendingDecision(null);
              }}
              disabled={pending}
            >
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.publicName}
                  {location.isPrimary ? " — Primary" : ""}
                </option>
              ))}
            </select>
            <small>
              Empty hours use this location. Changing the tool does not alter
              hours already assigned elsewhere.
            </small>
          </label>
          <div className="coach-week-location-legend">
            <strong>Location legend</strong>
            <ul>
              {activeLocations.map((location) => (
                <li
                  key={location.id}
                  style={locationStyle(
                    locationPaletteIndexes.get(location.id) ?? 0,
                  )}
                  data-training-location-id={location.id}
                  data-location-palette={
                    locationPaletteIndexes.get(location.id) ?? 0
                  }
                >
                  <span aria-hidden="true" />
                  <span>
                    <strong>{location.publicName}</strong>
                    <small>
                      {location.isPrimary ? "Primary · " : ""}
                      {location.location.label}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {pendingDecision && pendingExisting && (
          <section
            className="coach-week-cell-decision"
            aria-labelledby="coach-week-cell-decision-title"
            aria-live="polite"
          >
            <div>
              <span className="eyebrow">ASSIGNED SOMEWHERE ELSE</span>
              <strong id="coach-week-cell-decision-title">
                {pendingWeekday?.long} {pendingDecision.localStartTime}–
                {endTime(pendingDecision.localStartTime)} is assigned to{" "}
                {pendingExistingLocation?.publicName ??
                  "an unavailable location"}
                .
              </strong>
              <small>
                Choose explicitly. Nothing is saved until you use Save schedule.
              </small>
            </div>
            <div className="coach-week-cell-decision-actions">
              <button
                ref={moveDecisionRef}
                type="button"
                className="button dark"
                onClick={() => resolveDecision("move")}
              >
                Move to {selectedLocation.publicName}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => resolveDecision("keep")}
              >
                Keep {pendingExistingLocation?.publicName ?? "assignment"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => resolveDecision("remove")}
              >
                Remove hour
              </button>
            </div>
          </section>
        )}
        <div className="coach-week-save-bar">
          <p role="status" aria-live="polite">
            {dirty
              ? "Your changes are only on this screen until you save."
              : "Your displayed working week is saved."}
          </p>
        </div>
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
              const selectedCount = Array.from(draftAssignments.keys()).filter(
                (key) => key.startsWith(`${day.isoWeekday}|`),
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
            const selectedCount = Array.from(draftAssignments.keys()).filter(
              (key) => key.startsWith(`${day.isoWeekday}|`),
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
                  {WORKING_WEEK_HOURS.map((localStartTime, hourIndex) => {
                    const assignment =
                      draftAssignments.get(
                        scheduleRuleKey(day.isoWeekday, localStartTime),
                      ) ?? null;
                    return (
                      <div className="coach-mobile-hour" key={localStartTime}>
                        <span className="coach-mobile-time">
                          {`${localStartTime}–${endTime(localStartTime)}`}
                        </span>
                        <ScheduleCell
                          weekday={day.long}
                          localStartTime={localStartTime}
                          assignment={assignment}
                          assignmentLocation={
                            assignment
                              ? (locationById.get(assignment.locationId) ??
                                null)
                              : null
                          }
                          paletteIndex={
                            assignment
                              ? (locationPaletteIndexes.get(
                                  assignment.locationId,
                                ) ?? 0)
                              : 0
                          }
                          selectedLocation={selectedLocation}
                          pending={pending}
                          onToggle={() =>
                            toggleRule(day.isoWeekday, localStartTime)
                          }
                          gridColumn={dayIndex + 2}
                          gridRow={hourIndex + 2}
                        />
                      </div>
                    );
                  })}
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
            working week creates them automatically, and every row names the
            actual saved venue for that occurrence.
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
                  <strong>{slot.location.name}</strong>
                  <small>{slot.location.label}</small>
                </span>
              </div>
              <em>
                {slot.status === "booked"
                  ? "Reserved hour"
                  : slot.recurrenceRuleId
                    ? "Working week"
                    : "Earlier one-off"}
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
  view,
  bookingContent,
  ownerDisplayName,
  saveRuleSetAction,
}: {
  coach: CoachProjection | null;
  rules: readonly OwnedCoachAvailabilityRule[];
  slots: readonly OwnedCoachAvailabilitySlot[];
  view: CoachWorkspaceView;
  bookingContent?: ReactNode;
  ownerDisplayName: string;
  saveRuleSetAction: CoachAvailabilityRuleSetAction;
}) {
  return (
    <div className="coach-workspace">
      <CoachWorkspaceHeader coach={coach} ownerDisplayName={ownerDisplayName} />
      <CoachWorkspaceNavigation active={view} />

      {view === "bookings" && coach ? (
        bookingContent
      ) : !coach ? (
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
            saveRuleSetAction={saveRuleSetAction}
          />
          <UpcomingOccurrences slots={slots} />
        </>
      )}
    </div>
  );
}
