"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function SessionLinkPending({
  label,
  children,
  pending: navigationPending,
}: {
  label: string;
  children: ReactNode;
  pending?: boolean;
}) {
  const { pending: linkPending } = useLinkStatus();
  const pending = navigationPending || linkPending;
  return (
    <>
      {pending ? (
        <LoaderCircle
          size={16}
          aria-hidden="true"
          className="session-link-pending"
        />
      ) : (
        children
      )}
      <span className="sr-only" role="status">
        {pending ? `Loading ${label.toLowerCase()}…` : ""}
      </span>
    </>
  );
}
