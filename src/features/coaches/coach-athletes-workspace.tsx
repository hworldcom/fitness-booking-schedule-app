"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, UserPlus, UsersRound } from "lucide-react";
import {
  coachAthletesHref,
  type CoachAthletesSection,
} from "@/domain/coach-athletes-navigation";

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
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
