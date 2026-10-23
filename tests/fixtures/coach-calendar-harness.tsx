"use client";
import { useMemo, useRef, useSyncExternalStore } from "react";
import {
  calendarPeriod,
  calendarSelection,
  calendarQueryKey,
} from "@/domain/coach-calendar";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachCalendar } from "@/features/coaches/coach-calendar";
import { CoachScheduleNavigation } from "@/features/coaches/coach-schedule-navigation";
import type { CoachCalendarLoader } from "@/calendar/contracts";
import { AVAILABILITY_COACH } from "./availability-editor-data";
import { AvailabilityEditorHarness } from "./availability-editor-harness";
import { calendarFixture } from "./coach-calendar-data";
export function CoachCalendarHarness({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const selection = calendarSelection(params, "2026-10-16");
  const period = calendarPeriod(selection);
  const query = {
    from: period.from,
    through: period.through,
    type: selection.type,
    venueId: selection.venueId,
    history: selection.history,
    after: null,
  };
  const fault = useRef("none");
  const epoch = useRef(0);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const pausedReason =
    params.suspended === "1"
      ? "coach-suspended"
      : params.historyOnly === "1"
        ? "profile-hidden"
        : null;
  const load = useMemo<CoachCalendarLoader>(
    () => async (query) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (fault.current === "denied")
        return { status: "denied", message: "Fixture authorization revoked" };
      if (fault.current === "unavailable")
        return {
          status: "unavailable",
          message: "Fixture calendar unavailable. Retry this period.",
        };
      if (fault.current === "changed") {
        epoch.current++;
        fault.current = "none";
      }
      return {
        status: "ready",
        data: calendarFixture(query, epoch.current, pausedReason),
      };
    },
    [pausedReason],
  );
  if (params.section === "availability")
    return (
      <AvailabilityEditorHarness
        date={selection.date}
        tab={params.date ? "dates" : "weekly"}
        navigation={
          <CoachScheduleNavigation
            active="availability"
            date={selection.date}
          />
        }
      />
    );
  return (
    <>
      <aside
        aria-label="Calendar test controls"
        style={{
          padding: 12,
          border: "1px dashed #9b9",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <strong>Isolated calendar fixture — no database or real saves</strong>
        <span data-testid="fixture-ready">
          {hydrated ? "Ready" : "Loading"}
        </span>
        <label>
          Response scenario{" "}
          <select
            aria-label="Calendar response scenario"
            onChange={(e) => {
              fault.current = e.target.value;
            }}
          >
            <option value="none">Normal</option>
            <option value="unavailable">Unavailable</option>
            <option value="changed">Change between pages</option>
            <option value="denied">Revoke access</option>
          </select>
        </label>
      </aside>
      <CoachAvailabilityPanel
        coach={
          pausedReason
            ? { ...AVAILABILITY_COACH, visibility: "hidden" }
            : AVAILABILITY_COACH
        }
        view="schedule"
        ownerDisplayName="Schedule Coach"
        allowScheduleHistory
        scheduleContent={
          <>
            <CoachScheduleNavigation active="calendar" date={selection.date} />
            <CoachCalendar
              key={calendarQueryKey(query)}
              initial={calendarFixture(query, 0, pausedReason)}
              selection={selection}
              load={load}
            />
          </>
        }
      />
    </>
  );
}
