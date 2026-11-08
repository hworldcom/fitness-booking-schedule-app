"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, UserPlus, UsersRound } from "lucide-react";
import {
  coachAthletesHref,
  type CoachAthletesSection,
} from "@/domain/coach-athletes-navigation";
import {
  ConnectionRequestCountProvider,
  ConnectionRequestCountBadge,
  ConnectionRequestCountRetry,
  connectionRequestCountLabel,
  useConnectionRequestCount,
} from "@/features/connections/connection-request-count";

export function CoachAthletesWorkspace({
  active,
  children,
  navigationDisabled = false,
}: {
  active: CoachAthletesSection;
  children?: ReactNode;
  navigationDisabled?: boolean;
}) {
  return (
    <ConnectionRequestCountProvider role="coach" viewKey={active}>
      <div className="coach-workspace">
        <header className="coach-workspace-header">
          <div>
            <span className="eyebrow">YOUR ATHLETES</span>
            <h1>My athletes</h1>
            <p>
              Manage your connected athletes, external athletes and connection
              requests.
            </p>
          </div>
        </header>
        <CoachAthletesNavigation
          active={active}
          navigationDisabled={navigationDisabled}
        />
        {children}
      </div>
    </ConnectionRequestCountProvider>
  );
}

export function CoachAthletesNavigation({
  active,
  navigationDisabled = false,
}: {
  active: CoachAthletesSection;
  navigationDisabled?: boolean;
}) {
  const { count } = useConnectionRequestCount();
  return (
    <nav
      className="workspace-section-navigation"
      aria-label="My athletes sections"
    >
      {(
        [
          ["connected", "Connected athletes", UsersRound],
          ["external", "External athletes", UserPlus],
          ["requests", "Connection requests", ClipboardList],
        ] as const
      ).map(([section, label, Icon]) => (
        <Link
          key={section}
          href={coachAthletesHref(section)}
          aria-current={active === section ? "page" : undefined}
          aria-label={
            section === "requests"
              ? connectionRequestCountLabel(count)
              : undefined
          }
          aria-disabled={navigationDisabled || undefined}
          tabIndex={navigationDisabled ? -1 : undefined}
          onClick={(event) => {
            if (navigationDisabled) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
          {section === "requests" && <ConnectionRequestCountBadge />}
        </Link>
      ))}
      <ConnectionRequestCountRetry />
    </nav>
  );
}
