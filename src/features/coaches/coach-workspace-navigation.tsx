import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  UsersRound,
  UserRound,
} from "lucide-react";
import type { CoachWorkspaceView } from "@/features/coaches/coach-workspace-view";

type CoachWorkspaceDestination = "profile" | "events" | CoachWorkspaceView;

const DESTINATIONS = Object.freeze([
  {
    id: "profile",
    label: "Profile",
    href: "/profile/coach",
    Icon: UserRound,
  },
  {
    id: "schedule",
    label: "Schedule",
    href: "/coach",
    Icon: CalendarClock,
  },
  {
    id: "bookings",
    label: "Bookings",
    href: "/coach?view=bookings",
    Icon: CalendarDays,
  },
  {
    id: "events",
    label: "Events",
    href: "/coach/events",
    Icon: UsersRound,
  },
] as const);

export function CoachWorkspaceNavigation({
  active,
}: {
  active: CoachWorkspaceDestination;
}) {
  return (
    <nav className="coach-workspace-nav" aria-label="Coach workspace">
      {DESTINATIONS.map(({ id, label, href, Icon }) => {
        const selected = id === active;
        return (
          <Link
            href={href}
            key={id}
            aria-current={selected ? "page" : undefined}
            className={selected ? "active" : undefined}
          >
            <Icon size={17} aria-hidden="true" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
