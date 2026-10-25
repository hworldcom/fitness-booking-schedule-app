"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";

export type ProfileEditField =
  | "banner"
  | "portrait"
  | "displayName"
  | "disciplines"
  | "bio"
  | "brandLabel"
  | "introduction"
  | "approach"
  | "experience"
  | "focusLabels"
  | "faqs"
  | "links"
  | "rate"
  | "media";

export function ProfileEditRegion({
  field,
  label,
  onEdit,
  children,
}: {
  field: ProfileEditField;
  label: string;
  onEdit: (field: ProfileEditField) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`profile-edit-region profile-edit-region-${field}`}
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onEdit(field);
      }}
    >
      {children}
      <button
        type="button"
        className="profile-edit-trigger"
        data-edit-field={field}
        aria-label={`Edit ${label}`}
      >
        <Pencil size={14} aria-hidden="true" /> <span>Edit {label}</span>
      </button>
    </div>
  );
}
