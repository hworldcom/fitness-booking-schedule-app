"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { CoachTrainingLocation } from "@/domain/coaches";
import type { AvailabilityRange } from "./availability-editor-model";

export function AvailabilityDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="availability-dialog"
      aria-labelledby={id}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const target = event.shiftKey ? focusable.at(-1) : focusable[0];
        const boundary = event.shiftKey ? focusable[0] : focusable.at(-1);
        if (document.activeElement === boundary && target) {
          event.preventDefault();
          target.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="availability-icon"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function AvailabilityRanges({
  label,
  ranges,
  locations,
  disabled,
  onChange,
}: {
  label: string;
  ranges: readonly AvailabilityRange[];
  locations: readonly CoachTrainingLocation[];
  disabled: boolean;
  onChange: (ranges: readonly AvailabilityRange[]) => void;
}) {
  const active = locations.filter((l) => l.status === "active");
  function change(id: string, patch: Partial<AvailabilityRange>) {
    onChange(ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  return (
    <div className="availability-ranges">
      {ranges.map((range, i) => (
        <div className="availability-range" key={range.id}>
          <label>
            <span className="sr-only">
              {label} range {i + 1} start
            </span>
            <select
              aria-label={`${label} range ${i + 1} start`}
              value={range.startTime}
              disabled={disabled}
              onChange={(e) => change(range.id, { startTime: e.target.value })}
            >
              {Array.from(
                { length: 23 },
                (_, h) => `${String(h).padStart(2, "0")}:00`,
              ).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <span className="availability-range-dash" aria-hidden="true">
            –
          </span>
          <label>
            <span className="sr-only">
              {label} range {i + 1} end
            </span>
            <select
              aria-label={`${label} range ${i + 1} end`}
              value={range.endTime}
              disabled={disabled}
              onChange={(e) => change(range.id, { endTime: e.target.value })}
            >
              {Array.from(
                { length: 23 },
                (_, h) => `${String(h + 1).padStart(2, "0")}:00`,
              ).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="availability-venue">
            <span className="sr-only">
              {label} range {i + 1} venue
            </span>
            <select
              aria-label={`${label} range ${i + 1} venue`}
              value={range.locationId}
              disabled={disabled}
              onChange={(e) => {
                const l = active.find((l) => l.id === e.target.value);
                if (l)
                  change(range.id, {
                    locationId: l.id,
                    locationUpdatedAt: l.updatedAt,
                  });
              }}
            >
              {!active.some((l) => l.id === range.locationId) && (
                <option value={range.locationId}>
                  Unavailable venue — choose another
                </option>
              )}
              {active.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.publicName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="availability-icon"
            aria-label={`Remove ${label} range ${i + 1}`}
            disabled={disabled}
            onClick={() => onChange(ranges.filter((r) => r.id !== range.id))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {ranges.length < 23 && (
        <button
          type="button"
          className="availability-text-button"
          disabled={disabled || !active.length}
          onClick={() => {
            const l = active.find((l) => l.isPrimary) ?? active[0];
            const last = ranges.at(-1);
            const start =
              last && last.endTime < "23:00" ? last.endTime : "09:00";
            onChange([
              ...ranges,
              {
                id: crypto.randomUUID(),
                locationId: l.id,
                locationUpdatedAt: l.updatedAt,
                startTime: start,
                endTime: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00`,
              },
            ]);
          }}
        >
          <Plus size={15} /> Add range
        </button>
      )}
    </div>
  );
}
