"use client";

import { useEffect, useId, useRef, useState } from "react";

export function ConnectionDisconnectControl({
  name,
  disabled,
  onDisconnect,
}: {
  name: string;
  disabled: boolean;
  onDisconnect: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (confirming) cancel.current?.focus({ preventScroll: true });
  }, [confirming]);
  if (!confirming)
    return (
      <button
        ref={trigger}
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        aria-expanded={false}
      >
        Disconnect
      </button>
    );
  return (
    <div
      className="coach-connection-confirmation"
      role="group"
      aria-labelledby={id}
    >
      <p id={id}>
        Disconnect from {name}? Your sessions and shared history are kept.
        Reconnecting needs a new request and acceptance.
      </p>
      <div className="coach-connection-actions">
        <button
          ref={cancel}
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={() => {
            setConfirming(false);
            requestAnimationFrame(() =>
              trigger.current?.focus({ preventScroll: true }),
            );
          }}
        >
          Stay connected
        </button>
        <button
          type="button"
          className="button danger"
          disabled={disabled}
          onClick={onDisconnect}
        >
          Confirm disconnect
        </button>
      </div>
    </div>
  );
}
