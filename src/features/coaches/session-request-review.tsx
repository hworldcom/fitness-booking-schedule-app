"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function SessionRequestReview({
  open,
  onClose,
  onSubmit,
  busy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="session-request-review"
      aria-labelledby="session-request-review-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <h2 id="session-request-review-title">One last look.</h2>
      {children}
      <p>
        Send this time to the coach. Your session is confirmed only after the
        coach accepts your request.
      </p>
      <div className="session-request-review-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          Keep browsing
        </button>
        <button
          type="button"
          className="button dark"
          disabled={busy}
          onClick={onSubmit}
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </dialog>
  );
}
