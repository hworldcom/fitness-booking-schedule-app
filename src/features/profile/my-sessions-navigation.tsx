import Link from "next/link";
import {
  CalendarDays,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

type SessionType = "calendar" | "routine" | "private" | "group";

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

export function MySessionsNavigation({ active }: { active: SessionType }) {
  return (
    <nav
      className="workspace-section-navigation my-session-types"
      aria-label="Session type"
    >
      {sessionTypes.map(({ type, href, label, Icon }) => (
        <Link
          key={type}
          href={href}
          aria-current={active === type ? "page" : undefined}
        >
          <Icon size={16} aria-hidden="true" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function MySessionsHeading({ active }: { active: SessionType }) {
  return (
    <header className="client-session-page-heading">
      <span className="eyebrow">YOUR TRAINING</span>
      <h1>My training</h1>
      <p>
        {active === "calendar"
          ? "Your personal workouts and coaching sessions, together in one calendar."
          : active === "routine"
            ? "Build your weekly routine and make time for your personal workouts."
            : active === "private"
              ? "Your one-to-one coaching: booking requests, confirmed sessions and past training."
              : "Your group seat reservations and registration history. A seat reservation alone does not confirm a session."}
      </p>
      <MySessionsNavigation active={active} />
    </header>
  );
}
