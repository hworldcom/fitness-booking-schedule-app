"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  MySessionsHeading,
  type SessionNavigationAction,
} from "./my-sessions-navigation";
import { BookingPageLoading } from "./booking-page-loading";

export function BookingPageFrame({
  active,
  children,
}: {
  active: "private" | "group";
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, select] = useOptimistic(active);
  const [pending, startTransition] = useTransition();
  const navigate: SessionNavigationAction = (type, href, event) => {
    if (type !== "private" && type !== "group") return;
    event.preventDefault();
    startTransition(() => {
      select(type);
      if (
        pending &&
        href === window.location.pathname + window.location.search
      ) {
        // Reversing a pending navigation must not add a duplicate history entry.
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  };
  return (
    <div
      className={`booking-page-frame${selected === "group" ? " events-page" : ""}`}
    >
      <MySessionsHeading
        active={selected}
        onNavigate={navigate}
        pending={pending}
      />
      {pending && <BookingPageLoading active={selected} />}
      {/* Retain drafts and exact-retry IDs if navigation fails or is cancelled. */}
      <div hidden={pending} inert={pending}>
        {children}
      </div>
    </div>
  );
}
