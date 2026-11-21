import Link from "next/link";
import { SessionLinkPending } from "./session-link-pending";
import {
  CalendarDays,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

type SessionType = "calendar" | "routine" | "private" | "group";
export type SessionNavigationAction = (
  type: SessionType,
  href: string,
  event: { preventDefault: () => void },
) => void;
type NavigationProps = {
  active: SessionType;
  onNavigate?: SessionNavigationAction;
  pending?: boolean;
};

const sessionTypes = [
  {
    type: "calendar",
    href: "/sessions/calendar",
    label: "Calendar",
    Icon: CalendarDays,
  },
  {
    type: "routine",
    href: "/sessions/routine",
    label: "Plan routine",
    Icon: SlidersHorizontal,
  },
  {
    type: "private",
    href: "/sessions",
    label: "Private sessions",
    Icon: UserRound,
  },
  {
    type: "group",
    href: "/sessions/groups",
    label: "Group sessions",
    Icon: Users,
  },
] as const;

function isBookingView(type: SessionType) {
  return type === "private" || type === "group";
}

export function MySessionsNavigation({
  active,
  onNavigate,
  pending,
}: NavigationProps) {
  return (
    <nav
      className="workspace-section-navigation my-session-types"
      aria-label="Session type"
    >
      {sessionTypes
        .filter(({ type }) => isBookingView(type) === isBookingView(active))
        .map(({ type, href, label, Icon }) => (
          <Link
            key={type}
            href={href}
            prefetch={isBookingView(type) ? false : undefined}
            aria-label={label}
            aria-current={active === type ? "page" : undefined}
            onNavigate={
              onNavigate ? (event) => onNavigate(type, href, event) : undefined
            }
          >
            <SessionLinkPending
              label={label}
              pending={pending && active === type}
            >
              <Icon size={16} aria-hidden="true" />
            </SessionLinkPending>{" "}
            {label}
          </Link>
        ))}
    </nav>
  );
}

export function MySessionsHeading({
  active,
  onNavigate,
  pending,
}: NavigationProps) {
  return (
    <header className="client-session-page-heading">
      <span className="eyebrow">
        {isBookingView(active) ? "YOUR BOOKINGS" : "YOUR TRAINING"}
      </span>
      <h1>{isBookingView(active) ? "Bookings" : "My training"}</h1>
      <p>
        {active === "calendar"
          ? "Your personal workouts and coaching sessions, together in one calendar."
          : active === "routine"
            ? "Build your weekly routine and make time for your personal workouts."
            : active === "private"
              ? "Your one-to-one coaching: booking requests, confirmed sessions and past training."
              : "Your group seat reservations and registration history. A seat reservation alone does not confirm a session."}
      </p>
      <MySessionsNavigation
        active={active}
        onNavigate={onNavigate}
        pending={pending}
      />
    </header>
  );
}
