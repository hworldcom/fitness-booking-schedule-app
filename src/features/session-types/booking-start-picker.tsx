"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Modal } from "@/components/ui";
import { berlinLocalInstant } from "@/features/coach-events/contract";

const MINUTES = ["00", "15", "30", "45"];
const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

export function BookingStartPicker({
  value,
  suspended = false,
  onApply,
  onCancel,
}: {
  value: string;
  suspended?: boolean;
  onApply: (value: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(value.slice(0, 10));
  const [hour, setHour] = useState(value.slice(11, 13));
  const [minute, setMinute] = useState(
    MINUTES.includes(value.slice(14, 16)) ? value.slice(14, 16) : "",
  );
  const [error, setError] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);

  // Keep the draft, but remove the top-layer dialog while access is checked.
  if (suspended) return null;

  return (
    <Modal
      title="Choose session date and time"
      eyebrow="Berlin time"
      className="booking-start-dialog"
      onClose={onCancel}
    >
      <p>Apply selects the time. Review and Save confirm the booking change.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = `${date}T${hour}:${minute}`;
          const instant = berlinLocalInstant(next);
          if (
            !HOURS.includes(hour) ||
            !MINUTES.includes(minute) ||
            !instant ||
            Date.parse(instant) % 900000 !== 0
          ) {
            setError(
              "Choose a valid, unambiguous Berlin date and a time in 15-minute intervals.",
            );
            dateInput.current?.focus();
            return;
          }
          onApply(next);
        }}
      >
        <div className="booking-start-fields">
          <label>
            Date
            <input
              ref={dateInput}
              type="date"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setError("");
              }}
            />
          </label>
          <div className="booking-start-clock">
            <label>
              Hour
              <select
                aria-label="Hour"
                required
                value={hour}
                onChange={(event) => {
                  setHour(event.target.value);
                  setError("");
                }}
              >
                <option value="">Choose hour</option>
                {HOURS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minute
              <select
                aria-label="Minute"
                required
                value={minute}
                onChange={(event) => {
                  setMinute(event.target.value);
                  setError("");
                }}
              >
                <option value="">Choose minute</option>
                {MINUTES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>Start times are available at :00, :15, :30 and :45.</p>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="booking-start-actions">
          <button
            type="button"
            className="button secondary"
            aria-label="Cancel date and time selection"
            onClick={onCancel}
          >
            <X size={17} aria-hidden="true" /> Cancel
          </button>
          <button
            type="submit"
            className="button dark"
            aria-label="Apply date and time"
          >
            <Check size={17} aria-hidden="true" /> Apply
          </button>
        </div>
      </form>
    </Modal>
  );
}
