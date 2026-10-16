"use client";
// Test-only fixture: copy into an isolated Next.js checkout, never a production route.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { AvailabilityEditor } from "@/features/coaches/availability-editor";
import {
  applyAvailabilityCommand,
  type AvailabilityEditorActions,
  type AvailabilityEditorData,
} from "@/features/coaches/availability-editor-model";
import type {
  EffectiveAvailabilityCommand,
  EffectiveAvailabilityResult,
} from "@/domain/effective-availability";
import { AVAILABILITY_COACH } from "./availability-editor-data";

const initialData: AvailabilityEditorData = {
  scope: "fixture-user:fixture-profile:fixture-run:member",
  actorIdentity: "schedule-coach:fixture-run:member",
  today: "2026-10-16",
  locations: AVAILABILITY_COACH.locations.map((location, i) =>
    i
      ? {
          ...location,
          publicName:
            "Riverside strength and conditioning deck — Kreuzberg outdoor training",
        }
      : location,
  ),
  policy: {
    revision: 1,
    weeklyHours: [1, 2, 3, 4, 5].flatMap((day) =>
      [9, 10, 11].map((hour) => ({
        locationId: AVAILABILITY_COACH.locations[day === 3 ? 1 : 0].id,
        locationUpdatedAt:
          AVAILABILITY_COACH.locations[day === 3 ? 1 : 0].updatedAt,
        isoWeekday: day as 1 | 2 | 3 | 4 | 5,
        localStartTime: `${String(hour).padStart(2, "0")}:00`,
      })),
    ),
    dates: [{ date: "2026-10-20", mode: "unavailable", hours: [] }],
  },
};
export function AvailabilityEditorHarness({
  date = "2026-10-16",
  tab = "weekly",
}: {
  date?: string;
  tab?: "weekly" | "dates";
}) {
  const [initial, setInitial] = useState(initialData);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const data = useRef(initialData);
  const fault = useRef("none");
  const receipts = useRef(new Map<string, EffectiveAvailabilityResult>());
  const calls = useRef<EffectiveAvailabilityCommand[]>([]);
  const [audit, setAudit] = useState("");
  const actions = useMemo<AvailabilityEditorActions>(
    () => ({
      async load() {
        return fault.current === "denied"
          ? { status: "denied", message: "Fixture access revoked" }
          : fault.current === "unavailable"
            ? { status: "unavailable", message: "Fixture network unavailable" }
            : { status: "ready", data: data.current };
      },
      async change(command, _scope, preview) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (fault.current === "denied")
          return { status: "denied", message: "Fixture access revoked" };
        if (fault.current === "unavailable")
          return {
            status: "unavailable",
            message: "Fixture network unavailable; retry this exact save.",
          };
        if (fault.current === "invalid")
          return {
            status: "invalid",
            message:
              "That venue has changed or is inactive. Review the saved venues; the draft is retained.",
          };
        if (!preview) {
          calls.current.push(command);
          setAudit(JSON.stringify(calls.current));
          const receipt = receipts.current.get(command.operationId);
          if (receipt) return { status: "ready", result: receipt };
        }
        if (command.expectedRevision !== data.current.policy.revision)
          return {
            status: "ready",
            result: {
              outcome: "conflict",
              reason: "revision-changed",
              revision: data.current.policy.revision,
            },
          };
        const result: EffectiveAvailabilityResult = {
          outcome: "saved",
          revision: data.current.policy.revision + 1,
          closedRequestCount: 2,
          retainedSessions: [
            {
              kind: "private",
              id: "10000000-0000-4000-8000-000000000001",
              startsAt: "2026-10-20T08:00:00Z",
              endsAt: "2026-10-20T09:00:00Z",
              venue: "Tempelhofer Feld",
            },
            {
              kind: "group",
              id: "20000000-0000-4000-8000-000000000001",
              startsAt: "2026-10-20T13:00:00Z",
              endsAt: "2026-10-20T14:30:00Z",
              venue: "Riverside strength deck",
            },
          ],
        };
        if (!preview) {
          data.current = {
            ...data.current,
            policy: applyAvailabilityCommand(
              data.current.policy,
              command,
              result.revision,
            ),
          };
          receipts.current.set(command.operationId, result);
          if (fault.current === "lost") {
            fault.current = "none";
            throw new Error("Simulated lost response after commit");
          }
        }
        return { status: "ready", result };
      },
    }),
    [],
  );
  return (
    <>
      <aside
        aria-label="Test harness controls"
        style={{
          padding: 12,
          border: "1px dashed #9b9",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <strong>Isolated UI fixture — no database or real saves</strong>
        <span data-testid="fixture-ready">
          {hydrated ? "Ready" : "Loading"}
        </span>
        <label>
          Response scenario{" "}
          <select
            aria-label="Response scenario"
            onChange={(e) => {
              fault.current = e.target.value;
            }}
            defaultValue="none"
          >
            <option value="none">Normal</option>
            <option value="lost">Lose next save response</option>
            <option value="invalid">Inactive venue</option>
            <option value="denied">Access revoked</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <button
          onClick={() => {
            data.current = {
              ...data.current,
              policy: {
                ...data.current.policy,
                revision: data.current.policy.revision + 1,
              },
            };
            setInitial(data.current);
          }}
        >
          Simulate external revision
        </button>
        <output data-testid="operation-audit" hidden>
          {audit}
        </output>
      </aside>
      <CoachAvailabilityPanel
        coach={AVAILABILITY_COACH}
        view="schedule"
        ownerDisplayName="Schedule Coach"
        scheduleContent={
          <AvailabilityEditor
            initial={initial}
            initialDate={date}
            initialTab={tab}
            actions={actions}
          />
        }
      />
    </>
  );
}
