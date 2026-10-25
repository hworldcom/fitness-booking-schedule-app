"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Keep the controls mounted while closed: uploads and section drafts own their lifecycle. */
export function ProfileEditDrawer({
  open,
  title,
  field,
  focusReady = true,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  field: string | null;
  focusReady?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      previous.current =
        (field
          ? document.querySelector<HTMLElement>(`[data-edit-field="${field}"]`)
          : null) ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
      previous.current?.focus();
    }
  }, [open, field]);
  useEffect(() => {
    if (!open || !field || !focusReady) return;
    const frame = requestAnimationFrame(() => {
      const input = dialog.current?.querySelector<HTMLElement>(
        `[id$="-${field}"], [name="${field}"]`,
      );
      if (input && input.getClientRects().length) input.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, field, focusReady]);
  return (
    <dialog
      ref={dialog}
      className="profile-edit-drawer"
      aria-labelledby="profile-edit-drawer-title"
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="profile-edit-drawer-heading">
        <div>
          <span className="eyebrow">EDIT YOUR PROFILE</span>
          <h2 id="profile-edit-drawer-title">{title}</h2>
        </div>
        <button
          type="button"
          className="profile-drawer-close"
          aria-label="Close editing panel"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <p className="profile-drawer-hint">
        Closing this panel keeps your draft. Save or cancel in each section.
      </p>
      {children}
    </dialog>
  );
}
