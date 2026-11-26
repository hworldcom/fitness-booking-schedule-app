"use client";

import { useId, useRef, useState } from "react";
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
  const groupId = useId();
  const [date, setDate] = useState(value.slice(0, 10));
  const [hour, setHour] = useState(
    HOURS.includes(value.slice(11, 13)) ? value.slice(11, 13) : "",
  );
  const [minute, setMinute] = useState(
    MINUTES.includes(value.slice(14, 16)) ? value.slice(14, 16) : "",
  );
  const [error, setError] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);
  const dateInstant = new Date(`${date}T12:00:00Z`);
  const dateLabel = Number.isNaN(dateInstant.getTime())
    ? "Choose a date"
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(dateInstant);

  // Keep the draft, but remove the top-layer dialog while access is checked.
  if (suspended) return null;

  return (
    <Modal
      title="Choose session date and time"
      eyebrow="Berlin time · 24-hour clock"
      className="booking-start-dialog"
      onClose={onCancel}
    >
      <p>Choose a time in 15-minute intervals.</p>
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
          {[
            { label: "Hour", values: HOURS, selected: hour, choose: setHour },
            {
              label: "Minutes",
              values: MINUTES,
              selected: minute,
              choose: setMinute,
            },
          ].map(({ label, values, selected, choose }) => (
            <fieldset className="booking-start-options" key={label}>
              <legend>{label}</legend>
              <div
                className={`booking-start-grid ${label === "Hour" ? "booking-start-hours" : "booking-start-minutes"}`}
              >
                {values.map((item) => (
                  <label className="booking-start-choice" key={item}>
                    <input
                      type="radio"
                      name={`${groupId}-${label}`}
                      value={item}
                      checked={selected === item}
                      required
                      onChange={() => {
                        choose(item);
                        setError("");
                      }}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div
          className="booking-start-selection"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <small>Selected start · Berlin time</small>
            <p>{dateLabel}</p>
          </div>
          <strong>
            {hour && minute ? `${hour}:${minute}` : "Choose a time"}
          </strong>
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
