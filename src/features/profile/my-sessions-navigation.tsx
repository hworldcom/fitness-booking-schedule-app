import Link from "next/link";
import { Check, UserRound, Users } from "lucide-react";

type SessionType = "private" | "group";

const sessionTypes = [
  {
    type: "private",
    href: "/sessions",
    label: "Private sessions",
    description: "One-to-one coaching",
    Icon: UserRound,
  },
  {
    type: "group",
    href: "/sessions/groups",
    label: "Group sessions",
    description: "Train with a group",
    Icon: Users,
  },
] as const;

export function MySessionsNavigation({ active }: { active: SessionType }) {
  return (
    <nav className="my-session-types" aria-label="Session type">
      {sessionTypes.map(({ type, href, label, description, Icon }) => (
        <Link
          key={type}
          className="my-session-type"
          href={href}
          aria-current={active === type ? "page" : undefined}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="my-session-type-copy">
            <strong>{label}</strong>
            <span>{description}</span>
          </span>
          {active === type && (
            <Check
              className="my-session-type-check"
              size={18}
              aria-hidden="true"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}

export function MySessionsHeading({ active }: { active: SessionType }) {
  return (
    <header className="client-session-page-heading">
      <span className="eyebrow">YOUR TRAINING</span>
      <h1>My sessions</h1>
      <p>
        {active === "private"
          ? "Your one-to-one coaching: booking requests, confirmed sessions and past training."
          : "Your group seat reservations and registration history. A seat reservation alone does not confirm a session."}
      </p>
      <MySessionsNavigation active={active} />
    </header>
  );
}
